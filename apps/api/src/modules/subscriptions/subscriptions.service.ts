import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { z } from "zod";
import { PrismaService } from "../../prisma/prisma.service.js";

const CreateSubSchema = z.object({
  variantId: z.string().cuid(),
  intervalDays: z.number().int().min(7).max(90).default(30),
  quantity: z.number().int().positive().max(20).default(1),
});

@Injectable()
export class SubscriptionsService {
  constructor(private prisma: PrismaService) {}

  listAdmin() {
    return this.prisma.subscription.findMany({
      include: {
        customer: { select: { email: true } },
        variant: { select: { sku: true, price: true } },
        product: {
          include: { translations: { where: { locale: "en" }, take: 1 } },
        },
      },
      orderBy: { nextOrderAt: "asc" },
      take: 100,
    });
  }

  listForCustomer(customerId: string) {
    return this.prisma.subscription.findMany({
      where: { customerId },
      include: {
        variant: { select: { sku: true, price: true } },
        product: { include: { translations: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async create(customerId: string, input: unknown) {
    const data = CreateSubSchema.parse(input);
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: data.variantId },
      include: { product: true },
    });
    if (!variant || variant.product.status !== "active") {
      throw new NotFoundException("Variant not found");
    }
    const nextOrderAt = new Date();
    nextOrderAt.setDate(nextOrderAt.getDate() + data.intervalDays);
    return this.prisma.subscription.create({
      data: {
        customerId,
        productId: variant.productId,
        variantId: variant.id,
        intervalDays: data.intervalDays,
        quantity: data.quantity,
        nextOrderAt,
      },
    });
  }

  async cancel(customerId: string, id: string) {
    const sub = await this.prisma.subscription.findFirst({
      where: { id, customerId },
    });
    if (!sub) throw new NotFoundException("Subscription not found");
    if (sub.status === "cancelled") {
      throw new BadRequestException("Already cancelled");
    }
    return this.prisma.subscription.update({
      where: { id },
      data: { status: "cancelled" },
    });
  }
}
