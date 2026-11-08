import { BadRequestException, Injectable } from "@nestjs/common";
import { CreateCheckoutSchema } from "@online-store/shared-types";
import { type TaxClass } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service.js";
import { CartService } from "../cart/cart.service.js";
import { DiscountsService } from "../discounts/discounts.service.js";
import { PaymentsService } from "../payments/payments.service.js";
import { ShippingService } from "../shipping/shipping.service.js";
import { TaxService } from "../tax/tax.service.js";
import { assertAllowedCheckoutUrl } from "./checkout-urls.js";

const DEFAULT_FREE_SHIP_THRESHOLD = 4900;

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

  private async freeShipThreshold(): Promise<number> {
    const row = await this.prisma.storeSetting.findUnique({
      where: { key: "free_shipping_threshold_cents" },
    });
    const v = row?.value;
    if (typeof v === "number" && v >= 0) return v;
    if (v && typeof v === "object" && "amount" in v) {
      const n = Number((v as { amount: unknown }).amount);
      if (Number.isFinite(n) && n >= 0) return n;
    }
    return DEFAULT_FREE_SHIP_THRESHOLD;
  }

  /** Preview totals (gross prices, VAT included) without creating an order. */
  async quote(
    token: string | undefined,
    country: string,
    shippingRateId?: string,
  ) {
    if (!token) throw new BadRequestException("Cart token required");
    if (!country || country.length !== 2) {
      throw new BadRequestException("Country required");
    }
    const cart = await this.cart.requireCart(token);
    const totals = await this.computeTotals(cart, country, shippingRateId);
    return {
      subtotal: totals.subtotal,
      discountTotal: totals.discountTotal,
      shippingTotal: totals.shippingTotal,
      taxTotal: totals.taxTotal,
      total: totals.total,
      freeShipping: totals.freeShipping,
      freeShipThreshold: totals.freeShipThreshold,
      currency: totals.currency,
      shippingRateId: totals.rate?.id ?? null,
      shippingRateName: totals.rate?.name ?? null,
    };
  }

  private async computeTotals(
    cart: Awaited<ReturnType<CartService["requireCart"]>>,
    country: string,
    shippingRateId?: string,
  ) {
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

    const threshold = await this.freeShipThreshold();
    if (subtotal - discountTotal >= threshold) freeShipping = true;

    const weight = cart.lines.reduce(
      (sum, l) => sum + l.variant.weightGrams * l.quantity,
      0,
    );
    const rate = shippingRateId
      ? await this.shipping.getRate(shippingRateId)
      : await this.shipping.quote(country, weight);
    const shippingTotal = freeShipping ? 0 : (rate?.price ?? 0);

    // Gross (tax-inclusive) pricing: total is sum of gross lines, not net+VAT
    const grossMerchandise = Math.max(0, subtotal - discountTotal);
    const total = grossMerchandise + shippingTotal;

    let taxTotal = 0;
    const lineTaxes: { variantId: string; taxClass: TaxClass; taxTotal: number }[] =
      [];
    for (const l of cart.lines) {
      const taxClass = (l.variant.product.taxClass ?? "standard") as TaxClass;
      const lineGross = l.variant.price * l.quantity;
      const share =
        subtotal > 0 ? lineGross / subtotal : 0;
      const lineAfterDiscount = Math.round(
        lineGross - discountTotal * share,
      );
      const lineTax = await this.tax.extractFromGross(
        country,
        Math.max(0, lineAfterDiscount),
        taxClass,
      );
      taxTotal += lineTax;
      lineTaxes.push({
        variantId: l.variantId,
        taxClass,
        taxTotal: lineTax,
      });
    }
    const shippingTax = await this.tax.extractFromGross(
      country,
      shippingTotal,
      "standard",
    );
    taxTotal += shippingTax;

    return {
      subtotal,
      discountTotal,
      shippingTotal,
      taxTotal,
      total,
      freeShipping,
      freeShipThreshold: threshold,
      rate,
      lineTaxes,
      currency: "EUR" as const,
    };
  }

  async create(
    token: string | undefined,
    input: unknown,
    idempotencyKey?: string,
    customerId?: string,
  ) {
    const data = CreateCheckoutSchema.parse(input);
    if (!token) throw new BadRequestException("Cart token required");
    if (!data.acceptTerms) {
      throw new BadRequestException("Terms must be accepted");
    }

    assertAllowedCheckoutUrl(data.successUrl, "successUrl");
    assertAllowedCheckoutUrl(data.cancelUrl, "cancelUrl");

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
    const totals = await this.computeTotals(
      cart,
      data.shippingAddress.country,
      data.shippingRateId,
    );

    // Stock pre-check (reservation is decrement-at-pay + auto-refund)
    for (const l of cart.lines) {
      const inv = l.variant.inventory;
      if (
        inv?.policy === "deny" &&
        inv.quantity < l.quantity
      ) {
        throw new BadRequestException(`Insufficient stock for ${l.variant.sku}`);
      }
    }

    const taxByVariant = new Map(
      totals.lineTaxes.map((t) => [t.variantId, t]),
    );

    const order = await this.prisma.order.create({
      data: {
        status: "pending_payment",
        currency: "EUR",
        locale: data.locale,
        email: data.shippingAddress.email,
        customerId: customerId || undefined,
        subtotal: totals.subtotal,
        discountTotal: totals.discountTotal,
        shippingTotal: totals.shippingTotal,
        taxTotal: totals.taxTotal,
        total: totals.total,
        discountCode: cart.discountCode,
        shippingAddress: data.shippingAddress,
        shippingRateId: totals.rate?.id,
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
            const lt = taxByVariant.get(l.variantId);
            return {
              variantId: l.variantId,
              title: t?.title ?? "Product",
              variantTitle,
              sku: l.variant.sku,
              quantity: l.quantity,
              unitPrice: l.variant.price,
              total: l.variant.price * l.quantity,
              taxClass: lt?.taxClass ?? "standard",
              taxTotal: lt?.taxTotal ?? 0,
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

    // Persist email on cart for abandoned-cart recovery
    await this.prisma.cart.update({
      where: { id: cart.id },
      data: {
        email: data.shippingAddress.email,
        lastActivityAt: new Date(),
      },
    });

    const session = await this.payments.createCheckoutSession({
      orderId: order.id,
      amount: totals.total,
      currency: "EUR",
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
      shippingAmount: totals.shippingTotal,
      taxAmount: 0,
      discountAmount: totals.discountTotal,
    });

    await this.prisma.order.update({
      where: { id: order.id },
      data: { stripeSessionId: session.id },
    });

    return {
      orderId: order.id,
      checkoutUrl: session.url,
      totals: {
        subtotal: totals.subtotal,
        discountTotal: totals.discountTotal,
        shippingTotal: totals.shippingTotal,
        taxTotal: totals.taxTotal,
        total: totals.total,
        currency: "EUR",
      },
    };
  }
}
