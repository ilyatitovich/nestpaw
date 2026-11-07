import { Injectable, NotFoundException } from "@nestjs/common";
import { CreatePageSchema } from "@online-store/shared-types";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import type { PrismaService } from "../../prisma/prisma.service.js";

const MenuSchema = z.object({
  handle: z.string().min(1),
  title: z.string().min(1),
  items: z.array(
    z.object({
      title: z.string().min(1),
      url: z.string().min(1),
      position: z.number().int().default(0),
    }),
  ),
});

@Injectable()
export class CmsService {
  constructor(private prisma: PrismaService) {}

  listPages() {
    return this.prisma.page.findMany({
      include: { translations: true },
      orderBy: { updatedAt: "desc" },
    });
  }

  createPage(input: unknown) {
    const data = CreatePageSchema.parse(input);
    return this.prisma.page.create({
      data: {
        status: data.status,
        blocks: data.blocks as Prisma.InputJsonValue,
        translations: { create: data.translations },
      },
      include: { translations: true },
    });
  }

  async getPageBySlug(locale: string, slug: string) {
    const t = await this.prisma.pageTranslation.findUnique({
      where: { locale_slug: { locale, slug } },
      include: { page: { include: { translations: true } } },
    });
    if (!t || t.page.status !== "published") {
      throw new NotFoundException("Page not found");
    }
    return t.page;
  }

  upsertMenu(input: unknown) {
    const data = MenuSchema.parse(input);
    return this.prisma.$transaction(async (tx) => {
      await tx.menuItem.deleteMany({
        where: { menu: { handle: data.handle } },
      });
      return tx.menu.upsert({
        where: { handle: data.handle },
        create: {
          handle: data.handle,
          title: data.title,
          items: { create: data.items },
        },
        update: {
          title: data.title,
          items: { create: data.items },
        },
        include: { items: { orderBy: { position: "asc" } } },
      });
    });
  }

  getMenu(handle: string) {
    return this.prisma.menu.findUnique({
      where: { handle },
      include: { items: { orderBy: { position: "asc" } } },
    });
  }
}
