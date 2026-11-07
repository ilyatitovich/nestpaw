import { Injectable, NotFoundException } from "@nestjs/common";
import { z } from "zod";
import { PrismaService } from "../../prisma/prisma.service.js";

const AdjustSchema = z.object({
  quantity: z.number().int(),
  policy: z.enum(["deny", "continue"]).optional(),
});

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.inventoryItem.findMany({
      include: {
        variant: {
          include: {
            product: { include: { translations: true } },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });
  }

  async adjust(variantId: string, input: unknown) {
    const data = AdjustSchema.parse(input);
    const item = await this.prisma.inventoryItem.findUnique({
      where: { variantId },
    });
    if (!item) throw new NotFoundException("Inventory item not found");
    return this.prisma.inventoryItem.update({
      where: { variantId },
      data: {
        quantity: data.quantity,
        policy: data.policy,
      },
    });
  }

  async bulkAdjust(items: { variantId: string; quantity: number }[]) {
    return this.prisma.$transaction(
      items.map((i) =>
        this.prisma.inventoryItem.update({
          where: { variantId: i.variantId },
          data: { quantity: i.quantity },
        }),
      ),
    );
  }
}
