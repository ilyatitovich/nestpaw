import { BadRequestException, Injectable } from "@nestjs/common";
import { CreateCheckoutSchema } from "@online-store/shared-types";
import type { PrismaService } from "../../prisma/prisma.service.js";
import type { CartService } from "../cart/cart.service.js";
import type { DiscountsService } from "../discounts/discounts.service.js";
import type { PaymentsService } from "../payments/payments.service.js";
import type { ShippingService } from "../shipping/shipping.service.js";
import type { TaxService } from "../tax/tax.service.js";

@Injectable()
export class CheckoutService {
  constructor(
    private prisma: PrismaService,
    private cart: CartService,
    private payments: PaymentsService,
    private shipping: ShippingService,
    private tax: TaxService,
    private discounts: DiscountsService,
  ) {}

  async create(
    token: string | undefined,
    input: unknown,
    idempotencyKey?: string,
  ) {
    const data = CreateCheckoutSchema.parse(input);
    if (!token) throw new BadRequestException("Cart token required");

    if (idempotencyKey) {
      const existing = await this.prisma.order.findUnique({
        where: { idempotencyKey },
      });
      if (existing?.stripeSessionId) {
        const session = await this.payments.retrieveSession(
          existing.stripeSessionId,
        );
        return { orderId: existing.id, checkoutUrl: session.url };
      }
    }

    const cart = await this.cart.requireCart(token);
    if (!cart.lines.length) throw new BadRequestException("Cart is empty");

    const subtotal = cart.lines.reduce(
      (sum, l) => sum + l.variant.price * l.quantity,
      0,
    );

    let discountTotal = 0;
    let freeShipping = false;
    if (cart.discountCode) {
      const discount = await this.discounts.validate(
        cart.discountCode,
        subtotal,
      );
      if (discount.type === "free_shipping") freeShipping = true;
      else discountTotal = this.discounts.computeAmount(discount, subtotal);
    }

    const weight = cart.lines.reduce(
      (sum, l) => sum + l.variant.weightGrams * l.quantity,
      0,
    );
    const rate = data.shippingRateId
      ? await this.shipping.getRate(data.shippingRateId)
      : await this.shipping.quote(data.shippingAddress.country, weight);
    const shippingTotal = freeShipping ? 0 : (rate?.price ?? 0);

    const taxable = Math.max(0, subtotal - discountTotal + shippingTotal);
    const taxTotal = await this.tax.calculate(
      data.shippingAddress.country,
      taxable,
    );
    const total = taxable + taxTotal;

    const order = await this.prisma.order.create({
      data: {
        status: "pending_payment",
        currency: data.currency,
        locale: data.locale,
        email: data.shippingAddress.email,
        subtotal,
        discountTotal,
        shippingTotal,
        taxTotal,
        total,
        discountCode: cart.discountCode,
        shippingAddress: data.shippingAddress,
        shippingRateId: rate?.id,
        idempotencyKey,
        lines: {
          create: cart.lines.map((l) => {
            const t =
              l.variant.product.translations.find(
                (x) => x.locale === data.locale,
              ) ?? l.variant.product.translations[0];
            const variantTitle = [
              l.variant.option1,
              l.variant.option2,
              l.variant.option3,
            ]
              .filter(Boolean)
              .join(" / ");
            return {
              variantId: l.variantId,
              title: t?.title ?? "Product",
              variantTitle,
              sku: l.variant.sku,
              quantity: l.quantity,
              unitPrice: l.variant.price,
              total: l.variant.price * l.quantity,
            };
          }),
        },
        transitions: {
          create: {
            toStatus: "pending_payment",
            actorType: "customer",
            note: "Checkout started",
          },
        },
      },
    });

    const session = await this.payments.createCheckoutSession({
      orderId: order.id,
      amount: total,
      currency: data.currency,
      email: data.shippingAddress.email,
      successUrl: data.successUrl,
      cancelUrl: data.cancelUrl,
      lineItems: cart.lines.map((l) => {
        const t =
          l.variant.product.translations.find(
            (x) => x.locale === data.locale,
          ) ?? l.variant.product.translations[0];
        return {
          name: t?.title ?? l.variant.sku,
          amount: l.variant.price,
          quantity: l.quantity,
        };
      }),
      shippingAmount: shippingTotal,
      taxAmount: taxTotal,
      discountAmount: discountTotal,
    });

    await this.prisma.order.update({
      where: { id: order.id },
      data: { stripeSessionId: session.id },
    });

    return { orderId: order.id, checkoutUrl: session.url };
  }
}
