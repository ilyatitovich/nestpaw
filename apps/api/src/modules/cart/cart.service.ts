import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AddToCartSchema,
  ApplyDiscountSchema,
  UpdateCartLineSchema,
} from "@online-store/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { DiscountsService } from "../discounts/discounts.service";

const cartInclude = {
  lines: {
    include: {
      variant: {
        include: {
          inventory: true,
          product: { include: { translations: true, media: true } },
        },
      },
    },
  },
} as const;

@Injectable()
export class CartService {
  constructor(
    private prisma: PrismaService,
    private discounts: DiscountsService,
  ) {}

  async getOrCreate(token?: string, currency = "EUR") {
    if (token) {
      const existing = await this.prisma.cart.findUnique({
        where: { token },
        include: cartInclude,
      });
      if (existing) return this.withTotals(existing);
    }
    const cart = await this.prisma.cart.create({
      data: { currency },
      include: cartInclude,
    });
    return this.withTotals(cart);
  }

  async add(token: string | undefined, input: unknown) {
    const { variantId, quantity } = AddToCartSchema.parse(input);
    const cart = await this.getOrCreate(token);
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      include: { inventory: true, product: true },
    });
    if (!variant || variant.product.status !== "active") {
      throw new NotFoundException("Variant not found");
    }
    this.assertStock(
      variant.inventory?.quantity ?? 0,
      variant.inventory?.policy ?? "deny",
      quantity,
    );

    await this.prisma.cartLine.upsert({
      where: { cartId_variantId: { cartId: cart.id, variantId } },
      create: { cartId: cart.id, variantId, quantity },
      update: { quantity: { increment: quantity } },
    });

    return this.getOrCreate(cart.token);
  }

  async updateLine(token: string, lineId: string, input: unknown) {
    const { quantity } = UpdateCartLineSchema.parse(input);
    const cart = await this.requireCart(token);
    const line = cart.lines.find((l) => l.id === lineId);
    if (!line) throw new NotFoundException("Line not found");

    if (quantity === 0) {
      await this.prisma.cartLine.delete({ where: { id: lineId } });
    } else {
      this.assertStock(
        line.variant.inventory?.quantity ?? 0,
        line.variant.inventory?.policy ?? "deny",
        quantity,
      );
      await this.prisma.cartLine.update({
        where: { id: lineId },
        data: { quantity },
      });
    }
    return this.getOrCreate(token);
  }

  async applyDiscount(token: string, input: unknown) {
    const { code } = ApplyDiscountSchema.parse(input);
    const cart = await this.requireCart(token);
    const subtotal = cart.lines.reduce(
      (sum, l) => sum + l.variant.price * l.quantity,
      0,
    );
    await this.discounts.validate(code, subtotal);
    await this.prisma.cart.update({
      where: { id: cart.id },
      data: { discountCode: code.toUpperCase() },
    });
    return this.getOrCreate(token);
  }

  async clearDiscount(token: string) {
    const cart = await this.requireCart(token);
    await this.prisma.cart.update({
      where: { id: cart.id },
      data: { discountCode: null },
    });
    return this.getOrCreate(token);
  }

  async requireCart(token: string) {
    const cart = await this.prisma.cart.findUnique({
      where: { token },
      include: cartInclude,
    });
    if (!cart) throw new NotFoundException("Cart not found");
    return cart;
  }

  private assertStock(
    available: number,
    policy: "deny" | "continue",
    requested: number,
  ) {
    if (policy === "deny" && requested > available) {
      throw new BadRequestException("Insufficient stock");
    }
  }

  private async withTotals(
    cart: Awaited<ReturnType<CartService["requireCart"]>>,
  ) {
    const subtotal = cart.lines.reduce(
      (sum, l) => sum + l.variant.price * l.quantity,
      0,
    );
    let discountTotal = 0;
    if (cart.discountCode) {
      try {
        const d = await this.discounts.validate(cart.discountCode, subtotal);
        discountTotal = this.discounts.computeAmount(d, subtotal);
      } catch {
        // stale code ignored until cleared
      }
    }
    return {
      ...cart,
      totals: {
        subtotal,
        discountTotal,
        total: Math.max(0, subtotal - discountTotal),
        currency: cart.currency,
      },
    };
  }
}
