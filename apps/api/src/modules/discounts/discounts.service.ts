import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { CreateDiscountSchema } from "@online-store/shared-types";
import type { DiscountCode } from "@prisma/client";
import type { PrismaService } from "../../prisma/prisma.service.js";
import { computeDiscountAmount } from "./compute-amount.js";

@Injectable()
export class DiscountsService {
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.discountCode.findMany({
      orderBy: { createdAt: "desc" },
    });
  }

  create(input: unknown) {
    const data = CreateDiscountSchema.parse(input);
    return this.prisma.discountCode.create({
      data: {
        code: data.code.toUpperCase(),
        type: data.type,
        value: data.value,
        minSubtotal: data.minSubtotal,
        usageLimit: data.usageLimit,
        startsAt: data.startsAt ? new Date(data.startsAt) : null,
        endsAt: data.endsAt ? new Date(data.endsAt) : null,
        active: data.active,
      },
    });
  }

  async validate(code: string, subtotal: number): Promise<DiscountCode> {
    const discount = await this.prisma.discountCode.findUnique({
      where: { code: code.toUpperCase() },
    });
    if (!discount || !discount.active) {
      throw new BadRequestException("Invalid discount code");
    }
    const now = new Date();
    if (discount.startsAt && discount.startsAt > now) {
      throw new BadRequestException("Discount not active yet");
    }
    if (discount.endsAt && discount.endsAt < now) {
      throw new BadRequestException("Discount expired");
    }
    if (
      discount.usageLimit != null &&
      discount.usageCount >= discount.usageLimit
    ) {
      throw new BadRequestException("Discount usage limit reached");
    }
    if (subtotal < discount.minSubtotal) {
      throw new BadRequestException("Order below discount minimum");
    }
    return discount;
  }

  computeAmount(discount: DiscountCode, subtotal: number) {
    return computeDiscountAmount(discount, subtotal);
  }

  async incrementUsage(code: string) {
    await this.prisma.discountCode.update({
      where: { code: code.toUpperCase() },
      data: { usageCount: { increment: 1 } },
    });
  }

  async remove(id: string) {
    try {
      return await this.prisma.discountCode.delete({ where: { id } });
    } catch {
      throw new NotFoundException("Discount not found");
    }
  }
}
