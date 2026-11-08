import { BadRequestException, Injectable } from "@nestjs/common";
import {
  CheckoutCountrySchema,
  CreateCheckoutSchema,
  CreateExpressCheckoutSchema,
} from "@online-store/shared-types";
import { type TaxClass } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service.js";
import { CartService } from "../cart/cart.service.js";
import { DiscountsService } from "../discounts/discounts.service.js";
import { PaymentsService } from "../payments/payments.service.js";
import { ShippingService } from "../shipping/shipping.service.js";
import { TaxService } from "../tax/tax.service.js";
import { assertAllowedCheckoutUrl } from "./checkout-urls.js";

const DEFAULT_FREE_SHIP_THRESHOLD = 4900;

function assertCheckoutCountry(country: string): string {
  const parsed = CheckoutCountrySchema.safeParse(country.toUpperCase());
  if (!parsed.success) {
    throw new BadRequestException("Unsupported shipping country");
  }
  return parsed.data;
}

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
    const cc = assertCheckoutCountry(country);
    const cart = await this.cart.requireCart(token);
    const totals = await this.computeTotals(cart, cc, shippingRateId);
    const weight = cart.lines.reduce(
      (sum, l) => sum + l.variant.weightGrams * l.quantity,
      0,
    );
    const rates = await this.shipping.ratesForCountry(cc, weight);
    const shippingRates = rates.map((r) => ({
      id: r.id,
      displayName: r.name,
      amount: totals.freeShipping ? 0 : r.price,
    }));
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
      shippingRates,
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
    const eligible = await this.shipping.ratesForCountry(country, weight);
    let rate = eligible[0] ?? null;
    if (shippingRateId) {
      const match = eligible.find((r) => r.id === shippingRateId);
      if (!match) {
        throw new BadRequestException(
          "Shipping rate is not available for this country",
        );
      }
      rate = match;
    }
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

  /** Standard checkout: create order + PaymentIntent, return clientSecret. */
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
    const country = assertCheckoutCountry(data.shippingAddress.country);
    const billingAddress = data.billingAddress
      ? {
          ...data.billingAddress,
          country: assertCheckoutCountry(data.billingAddress.country),
        }
      : undefined;

    if (idempotencyKey) {
      const existing = await this.prisma.order.findUnique({
        where: { idempotencyKey },
      });
      if (existing?.stripePaymentIntentId) {
        const intent = await this.payments.retrievePaymentIntent(
          existing.stripePaymentIntentId,
        );
        return {
          orderId: existing.id,
          clientSecret: intent.client_secret,
          totals: {
            subtotal: existing.subtotal,
            discountTotal: existing.discountTotal,
            shippingTotal: existing.shippingTotal,
            taxTotal: existing.taxTotal,
            total: existing.total,
            currency: "EUR" as const,
          },
        };
      }
    }

    const cart = await this.cart.requireCart(token);
    const { order, totals } = await this.createPendingOrder({
      cart,
      shippingAddress: { ...data.shippingAddress, country },
      billingAddress,
      shippingRateId: data.shippingRateId,
      locale: data.locale,
      idempotencyKey,
      customerId,
      note: "Checkout started",
    });

    const intent = await this.payments.createPaymentIntent({
      orderId: order.id,
      amount: totals.total,
      currency: "EUR",
      email: data.shippingAddress.email,
    });

    await this.prisma.order.update({
      where: { id: order.id },
      data: { stripePaymentIntentId: intent.id },
    });

    return {
      orderId: order.id,
      clientSecret: intent.client_secret,
      totals: {
        subtotal: totals.subtotal,
        discountTotal: totals.discountTotal,
        shippingTotal: totals.shippingTotal,
        taxTotal: totals.taxTotal,
        total: totals.total,
        currency: "EUR" as const,
      },
    };
  }

  /** Express wallets: create order + PaymentIntent, return clientSecret. */
  async createExpress(
    token: string | undefined,
    input: unknown,
    idempotencyKey?: string,
    customerId?: string,
  ) {
    const data = CreateExpressCheckoutSchema.parse(input);
    if (!token) throw new BadRequestException("Cart token required");
    if (!data.acceptTerms) {
      throw new BadRequestException("Terms must be accepted");
    }

    assertAllowedCheckoutUrl(data.successUrl, "successUrl");
    const country = assertCheckoutCountry(data.shippingAddress.country);

    if (idempotencyKey) {
      const existing = await this.prisma.order.findUnique({
        where: { idempotencyKey },
      });
      if (existing?.stripePaymentIntentId) {
        const intent = await this.payments.retrievePaymentIntent(
          existing.stripePaymentIntentId,
        );
        return {
          orderId: existing.id,
          clientSecret: intent.client_secret,
          totals: {
            subtotal: existing.subtotal,
            discountTotal: existing.discountTotal,
            shippingTotal: existing.shippingTotal,
            taxTotal: existing.taxTotal,
            total: existing.total,
            currency: "EUR" as const,
          },
        };
      }
    }

    const cart = await this.cart.requireCart(token);
    const { order, totals } = await this.createPendingOrder({
      cart,
      shippingAddress: { ...data.shippingAddress, country },
      shippingRateId: data.shippingRateId,
      locale: data.locale,
      idempotencyKey,
      customerId,
      note: "Express checkout started",
    });

    const intent = await this.payments.createPaymentIntent({
      orderId: order.id,
      amount: totals.total,
      currency: "EUR",
      email: data.shippingAddress.email,
    });

    await this.prisma.order.update({
      where: { id: order.id },
      data: { stripePaymentIntentId: intent.id },
    });

    return {
      orderId: order.id,
      clientSecret: intent.client_secret,
      totals: {
        subtotal: totals.subtotal,
        discountTotal: totals.discountTotal,
        shippingTotal: totals.shippingTotal,
        taxTotal: totals.taxTotal,
        total: totals.total,
        currency: "EUR" as const,
      },
    };
  }

  private async createPendingOrder(params: {
    cart: Awaited<ReturnType<CartService["requireCart"]>>;
    shippingAddress: {
      firstName: string;
      lastName: string;
      email: string;
      phone?: string;
      line1: string;
      line2?: string;
      city: string;
      postalCode: string;
      country: string;
      state?: string;
    };
    billingAddress?: {
      firstName: string;
      lastName: string;
      phone?: string;
      line1: string;
      line2?: string;
      city: string;
      postalCode: string;
      country: string;
      state?: string;
    };
    shippingRateId?: string;
    locale: string;
    idempotencyKey?: string;
    customerId?: string;
    note: string;
  }) {
    const {
      cart,
      shippingAddress,
      billingAddress,
      shippingRateId,
      locale,
      idempotencyKey,
      customerId,
      note,
    } = params;

    const totals = await this.computeTotals(
      cart,
      shippingAddress.country,
      shippingRateId,
    );

    for (const l of cart.lines) {
      const inv = l.variant.inventory;
      if (inv?.policy === "deny" && inv.quantity < l.quantity) {
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
        locale,
        email: shippingAddress.email,
        customerId: customerId || undefined,
        subtotal: totals.subtotal,
        discountTotal: totals.discountTotal,
        shippingTotal: totals.shippingTotal,
        taxTotal: totals.taxTotal,
        total: totals.total,
        discountCode: cart.discountCode,
        shippingAddress,
        billingAddress: billingAddress ?? undefined,
        shippingRateId: totals.rate?.id,
        idempotencyKey,
        lines: {
          create: cart.lines.map((l) => {
            const t =
              l.variant.product.translations.find((x) => x.locale === locale) ??
              l.variant.product.translations[0];
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
            note,
          },
        },
      },
    });

    await this.prisma.cart.update({
      where: { id: cart.id },
      data: {
        email: shippingAddress.email,
        lastActivityAt: new Date(),
      },
    });

    return { order, totals };
  }
}
