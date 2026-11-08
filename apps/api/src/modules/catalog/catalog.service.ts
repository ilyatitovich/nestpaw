import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  CreateCollectionSchema,
  CreateProductSchema,
  SetCollectionProductsSchema,
  UpdateCollectionSchema,
} from "@online-store/shared-types";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service.js";

@Injectable()
export class CatalogService {
  constructor(private prisma: PrismaService) {}

  async listProducts(params: {
    locale?: string;
    status?: string;
    q?: string;
    collection?: string;
    ids?: string[];
    take?: number;
    skip?: number;
    admin?: boolean;
    lifeStage?: string;
    productType?: string;
    species?: string;
    minPrice?: number;
    maxPrice?: number;
    sort?: "price_asc" | "price_desc" | "newest";
  }) {
    const take = Math.min(
      params.take ?? (params.ids?.length ? params.ids.length : 24),
      100,
    );
    const skip = params.skip ?? 0;
    const metafieldFilters: Prisma.MetafieldWhereInput[] = [];
    if (params.lifeStage) {
      metafieldFilters.push({
        namespace: "pet",
        key: "life_stage",
        value: { equals: params.lifeStage },
      });
    }
    if (params.productType) {
      metafieldFilters.push({
        namespace: "pet",
        key: "product_type",
        value: { equals: params.productType },
      });
    }
    if (params.species) {
      metafieldFilters.push({
        namespace: "pet",
        key: "species",
        value: { equals: params.species },
      });
    }

    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
      ...(params.status
        ? { status: params.status as "draft" | "active" | "archived" }
        : params.admin
          ? {}
          : { status: "active" }),
      ...(params.ids?.length ? { id: { in: params.ids } } : {}),
      ...(params.q
        ? {
            OR: [
              {
                translations: {
                  some: {
                    OR: [
                      { title: { contains: params.q, mode: "insensitive" } },
                      {
                        description: {
                          contains: params.q,
                          mode: "insensitive",
                        },
                      },
                    ],
                  },
                },
              },
              {
                variants: {
                  some: { sku: { contains: params.q, mode: "insensitive" } },
                },
              },
            ],
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
      ...(metafieldFilters.length
        ? { AND: metafieldFilters.map((f) => ({ metafields: { some: f } })) }
        : {}),
      ...(params.minPrice != null || params.maxPrice != null
        ? {
            variants: {
              some: {
                price: {
                  ...(params.minPrice != null
                    ? { gte: params.minPrice }
                    : {}),
                  ...(params.maxPrice != null
                    ? { lte: params.maxPrice }
                    : {}),
                },
              },
            },
          }
        : {}),
    };

    const orderBy: Prisma.ProductOrderByWithRelationInput =
      params.sort === "newest"
        ? { createdAt: "desc" }
        : { updatedAt: "desc" };

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: {
          translations: true,
          variants: { include: { inventory: true } },
          media: { orderBy: { position: "asc" } },
          metafields: true,
          collections: {
            include: { collection: { include: { translations: true } } },
          },
        },
        orderBy,
        take,
        skip,
      }),
      this.prisma.product.count({ where }),
    ]);

    let sorted = items;
    if (params.sort === "price_asc" || params.sort === "price_desc") {
      const dir = params.sort === "price_asc" ? 1 : -1;
      sorted = [...items].sort((a, b) => {
        const pa = a.variants[0]?.price ?? 0;
        const pb = b.variants[0]?.price ?? 0;
        return (pa - pb) * dir;
      });
    }

    return { items: sorted, total, take, skip };
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
            collections: {
              include: { collection: { include: { translations: true } } },
            },
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
        collections: {
          include: { collection: { include: { translations: true } } },
        },
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
          translations: {
            create: data.translations.map((t) => ({
              locale: t.locale,
              title: t.title,
              description: t.description,
              slug: t.slug,
              seoTitle: t.seoTitle,
              seoDescription: t.seoDescription,
              body:
                t.body === undefined || t.body === null
                  ? undefined
                  : (t.body as Prisma.InputJsonValue),
            })),
          },
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
          media: data.media
            ? {
                create: data.media.map((m, i) => ({
                  url: m.url,
                  alt: m.alt,
                  position: m.position ?? i,
                })),
              }
            : undefined,
          collections: data.collectionIds
            ? {
                create: data.collectionIds.map((collectionId, position) => ({
                  collectionId,
                  position,
                })),
              }
            : undefined,
        },
        include: {
          translations: true,
          variants: { include: { inventory: true } },
          media: true,
          metafields: true,
          collections: true,
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
          const bodyValue =
            t.body === undefined
              ? undefined
              : t.body === null
                ? Prisma.DbNull
                : (t.body as Prisma.InputJsonValue);
          const translationData = {
            locale: t.locale,
            title: t.title,
            description: t.description,
            slug: t.slug,
            seoTitle: t.seoTitle,
            seoDescription: t.seoDescription,
            ...(bodyValue !== undefined ? { body: bodyValue } : {}),
          };
          await tx.productTranslation.upsert({
            where: {
              productId_locale: { productId: id, locale: t.locale },
            },
            create: { productId: id, ...translationData },
            update: translationData,
          });
        }
      }

      if (data.metafields) {
        await tx.metafield.deleteMany({ where: { productId: id } });
        if (data.metafields.length) {
          await tx.metafield.createMany({
            data: data.metafields.map((m) => ({
              productId: id,
              namespace: m.namespace,
              key: m.key,
              type: m.type,
              value: m.value as Prisma.InputJsonValue,
            })),
          });
        }
      }

      if (data.media) {
        await tx.productMedia.deleteMany({ where: { productId: id } });
        if (data.media.length) {
          await tx.productMedia.createMany({
            data: data.media.map((m, i) => ({
              productId: id,
              url: m.url,
              alt: m.alt,
              position: m.position ?? i,
            })),
          });
        }
      }

      if (data.collectionIds) {
        await tx.collectionProduct.deleteMany({ where: { productId: id } });
        if (data.collectionIds.length) {
          await tx.collectionProduct.createMany({
            data: data.collectionIds.map((collectionId, position) => ({
              productId: id,
              collectionId,
              position,
            })),
          });
        }
      }

      if (data.variants?.length) {
        for (const v of data.variants) {
          const existing = await tx.productVariant.findFirst({
            where: { productId: id, sku: v.sku },
          });
          if (existing) {
            await tx.productVariant.update({
              where: { id: existing.id },
              data: {
                price: v.price,
                compareAtPrice: v.compareAtPrice,
                option1: v.option1,
                option2: v.option2,
                option3: v.option3,
                weightGrams: v.weightGrams,
              },
            });
            await tx.inventoryItem.upsert({
              where: { variantId: existing.id },
              create: {
                variantId: existing.id,
                quantity: v.stock,
                policy: v.stockPolicy,
              },
              update: { quantity: v.stock, policy: v.stockPolicy },
            });
          }
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
          collections: {
            include: { collection: { include: { translations: true } } },
          },
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

  private collectionInclude(locale?: string): Prisma.CollectionInclude {
    return {
      translations: locale ? { where: { locale } } : true,
      children: {
        include: {
          translations: locale ? { where: { locale } } : true,
          _count: { select: { products: true, children: true } },
        },
      },
      _count: { select: { products: true, children: true } },
      products: {
        include: {
          product: {
            include: {
              translations: true,
              media: { take: 1, orderBy: { position: "asc" as const } },
              variants: { take: 1, include: { inventory: true } },
              metafields: true,
            },
          },
        },
        orderBy: { position: "asc" as const },
      },
    };
  }

  async listCollections(locale?: string) {
    return this.prisma.collection.findMany({
      include: this.collectionInclude(locale),
      orderBy: { createdAt: "asc" },
    });
  }

  async getCollection(id: string) {
    const collection = await this.prisma.collection.findUnique({
      where: { id },
      include: this.collectionInclude(),
    });
    if (!collection) throw new NotFoundException("Collection not found");
    return collection;
  }

  async getCollectionBySlug(locale: string, slug: string) {
    const translation = await this.prisma.collectionTranslation.findUnique({
      where: { locale_slug: { locale, slug } },
    });
    if (!translation) throw new NotFoundException("Collection not found");
    return this.getCollection(translation.collectionId);
  }

  async createCollection(input: unknown) {
    const data = CreateCollectionSchema.parse(input);
    if (data.parentId) {
      const parent = await this.prisma.collection.findUnique({
        where: { id: data.parentId },
      });
      if (!parent) throw new BadRequestException("Parent collection not found");
    }
    try {
      return await this.prisma.collection.create({
        data: {
          parentId: data.parentId ?? null,
          translations: { create: data.translations },
          products: {
            create: data.productIds.map((productId, position) => ({
              productId,
              position,
            })),
          },
        },
        include: this.collectionInclude(),
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        throw new ConflictException("Collection slug already exists");
      }
      throw e;
    }
  }

  async updateCollection(id: string, input: unknown) {
    const data = UpdateCollectionSchema.parse(input);
    await this.getCollection(id);
    if (data.parentId === id) {
      throw new BadRequestException("Collection cannot be its own parent");
    }
    if (data.parentId) {
      const parent = await this.prisma.collection.findUnique({
        where: { id: data.parentId },
      });
      if (!parent) throw new BadRequestException("Parent collection not found");
    }

    return this.prisma.$transaction(async (tx) => {
      if (data.translations) {
        for (const t of data.translations) {
          await tx.collectionTranslation.upsert({
            where: {
              collectionId_locale: { collectionId: id, locale: t.locale },
            },
            create: { collectionId: id, ...t },
            update: t,
          });
        }
      }
      return tx.collection.update({
        where: { id },
        data: {
          ...(data.parentId !== undefined ? { parentId: data.parentId } : {}),
        },
        include: this.collectionInclude(),
      });
    });
  }

  async deleteCollection(id: string) {
    await this.getCollection(id);
    await this.prisma.collection.delete({ where: { id } });
    return { ok: true };
  }

  async setCollectionProducts(id: string, input: unknown) {
    const data = SetCollectionProductsSchema.parse(input);
    await this.getCollection(id);
    await this.prisma.$transaction(async (tx) => {
      await tx.collectionProduct.deleteMany({ where: { collectionId: id } });
      if (data.productIds.length) {
        await tx.collectionProduct.createMany({
          data: data.productIds.map((productId, position) => ({
            collectionId: id,
            productId,
            position,
          })),
        });
      }
    });
    return this.getCollection(id);
  }

  async search(q: string, locale = "en", take?: number) {
    return this.listProducts({ q, locale, status: "active", take });
  }

  async relatedProducts(productId: string, locale: string, take = 4) {
    const memberships = await this.prisma.collectionProduct.findMany({
      where: { productId },
      select: { collectionId: true },
    });
    if (!memberships.length) {
      return this.listProducts({ locale, status: "active", take });
    }
    const items = await this.prisma.product.findMany({
      where: {
        deletedAt: null,
        status: "active",
        id: { not: productId },
        collections: {
          some: {
            collectionId: { in: memberships.map((m) => m.collectionId) },
          },
        },
      },
      include: {
        translations: true,
        media: { take: 1, orderBy: { position: "asc" } },
        variants: { take: 1 },
        metafields: true,
      },
      take,
    });
    return { items, total: items.length };
  }
}
