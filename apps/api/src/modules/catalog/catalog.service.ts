import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import {
  CreateCollectionSchema,
  CreateProductSchema,
} from "@online-store/shared-types";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class CatalogService {
  constructor(private prisma: PrismaService) {}

  async listProducts(params: {
    locale?: string;
    status?: string;
    q?: string;
    collection?: string;
    take?: number;
    skip?: number;
    admin?: boolean;
  }) {
    const take = Math.min(params.take ?? 24, 100);
    const skip = params.skip ?? 0;
    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
      ...(params.status
        ? { status: params.status as "draft" | "active" | "archived" }
        : params.admin
          ? {}
          : { status: "active" }),
      ...(params.q
        ? {
            translations: {
              some: {
                OR: [
                  { title: { contains: params.q, mode: "insensitive" } },
                  { description: { contains: params.q, mode: "insensitive" } },
                ],
              },
            },
          }
        : {}),
      ...(params.collection
        ? {
            collections: {
              some: {
                collection: {
                  translations: {
                    some: { slug: params.collection },
                  },
                },
              },
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: {
          translations: true,
          variants: { include: { inventory: true } },
          media: { orderBy: { position: "asc" } },
          metafields: true,
        },
        orderBy: { updatedAt: "desc" },
        take,
        skip,
      }),
      this.prisma.product.count({ where }),
    ]);
    return { items, total, take, skip };
  }

  async getBySlug(locale: string, slug: string) {
    const translation = await this.prisma.productTranslation.findUnique({
      where: { locale_slug: { locale, slug } },
      include: {
        product: {
          include: {
            translations: true,
            variants: { include: { inventory: true } },
            media: { orderBy: { position: "asc" } },
            metafields: true,
            reviews: {
              where: { status: "approved" },
              orderBy: { createdAt: "desc" },
            },
          },
        },
      },
    });
    if (!translation || translation.product.deletedAt) {
      throw new NotFoundException("Product not found");
    }
    if (translation.product.status !== "active") {
      throw new NotFoundException("Product not found");
    }
    return translation.product;
  }

  async getAdmin(id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
      include: {
        translations: true,
        variants: { include: { inventory: true } },
        media: { orderBy: { position: "asc" } },
        metafields: true,
      },
    });
    if (!product) throw new NotFoundException("Product not found");
    return product;
  }

  async create(input: unknown) {
    const data = CreateProductSchema.parse(input);
    try {
      return await this.prisma.product.create({
        data: {
          status: data.status,
          option1Name: data.option1Name,
          option2Name: data.option2Name,
          option3Name: data.option3Name,
          translations: { create: data.translations },
          variants: {
            create: data.variants.map((v) => ({
              sku: v.sku,
              barcode: v.barcode,
              price: v.price,
              compareAtPrice: v.compareAtPrice,
              option1: v.option1,
              option2: v.option2,
              option3: v.option3,
              weightGrams: v.weightGrams,
              inventory: {
                create: { quantity: v.stock, policy: v.stockPolicy },
              },
            })),
          },
          metafields: data.metafields
            ? {
                create: data.metafields.map((m) => ({
                  namespace: m.namespace,
                  key: m.key,
                  type: m.type,
                  value: m.value as Prisma.InputJsonValue,
                })),
              }
            : undefined,
        },
        include: {
          translations: true,
          variants: { include: { inventory: true } },
          metafields: true,
        },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        throw new ConflictException("SKU or slug already exists");
      }
      throw e;
    }
  }

  async update(id: string, input: unknown) {
    const data = CreateProductSchema.partial().parse(input);
    await this.getAdmin(id);

    return this.prisma.$transaction(async (tx) => {
      if (data.translations) {
        for (const t of data.translations) {
          await tx.productTranslation.upsert({
            where: {
              productId_locale: { productId: id, locale: t.locale },
            },
            create: { productId: id, ...t },
            update: t,
          });
        }
      }

      return tx.product.update({
        where: { id },
        data: {
          status: data.status,
          option1Name: data.option1Name,
          option2Name: data.option2Name,
          option3Name: data.option3Name,
        },
        include: {
          translations: true,
          variants: { include: { inventory: true } },
          media: true,
          metafields: true,
        },
      });
    });
  }

  async softDelete(id: string) {
    await this.getAdmin(id);
    return this.prisma.product.update({
      where: { id },
      data: { deletedAt: new Date(), status: "archived" },
    });
  }

  async listCollections(locale?: string) {
    return this.prisma.collection.findMany({
      include: {
        translations: locale ? { where: { locale } } : true,
        products: {
          include: {
            product: {
              include: {
                translations: true,
                media: { take: 1, orderBy: { position: "asc" } },
                variants: { take: 1, include: { inventory: true } },
              },
            },
          },
          orderBy: { position: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async createCollection(input: unknown) {
    const data = CreateCollectionSchema.parse(input);
    return this.prisma.collection.create({
      data: {
        translations: { create: data.translations },
        products: {
          create: data.productIds.map((productId, position) => ({
            productId,
            position,
          })),
        },
      },
      include: { translations: true, products: true },
    });
  }

  async search(q: string, locale = "en") {
    // ponytail: Postgres ILIKE until Meilisearch needed
    return this.listProducts({ q, locale, status: "active" });
  }
}
