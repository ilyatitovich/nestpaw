import {
  BadRequestException,
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
} from "@nestjs/common";
import * as Sentry from "@sentry/node";
import Stripe from "stripe";
import { type WrapperType } from "../../common/wrapper-type.js";
import { PrismaService } from "../../prisma/prisma.service.js";
import { OrdersService } from "../orders/orders.service.js";
import { buildStripeLineItems } from "./build-stripe-line-items.js";
import { allowMockPayments } from "./mock-payments.js";

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private stripe: Stripe | null = null;

  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => OrdersService))
    private orders: WrapperType<OrdersService>,
  ) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (key && !key.includes("xxx")) {
      this.stripe = new Stripe(key, {
        apiVersion: "2024-11-20.acacia" as Stripe.LatestApiVersion,
      });
    }
  }

  private client() {
    if (!this.stripe) {
      if (!allowMockPayments()) {
        throw new ForbiddenException(
          "Stripe is not configured and mock payments are disabled",
        );
      }
      return null;
    }
    return this.stripe;
  }

  async createCheckoutSession(params: {
    orderId: string;
    amount: number;
    currency: string;
    email: string;
    successUrl: string;
    cancelUrl: string;
    lineItems: { name: string; amount: number; quantity: number }[];
    shippingAmount: number;
    taxAmount: number;
    discountAmount: number;
  }) {
    const priced = buildStripeLineItems({
      lineItems: params.lineItems,
      shippingAmount: params.shippingAmount,
      // Gross prices: VAT already in line amounts; don't add tax as a Stripe line
      taxAmount: 0,
      discountAmount: params.discountAmount,
      expectedTotal: params.amount,
    });

    const stripe = this.client();
    if (!stripe) {
      const mockId = `cs_test_mock_${params.orderId}`;
      return {
        id: mockId,
        url: `${params.successUrl}${params.successUrl.includes("?") ? "&" : "?"}session_id=${mockId}&mock=1`,
        amount_total: params.amount,
      };
    }

    const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] =
      priced.map((li) => ({
        quantity: li.quantity,
        price_data: {
          currency: params.currency.toLowerCase(),
          unit_amount: li.unitAmount,
          product_data: { name: li.name },
        },
      }));

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: params.email,
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      line_items,
      // Payment methods (Klarna/PayPal/SEPA) come from Stripe Dashboard settings
      metadata: { orderId: params.orderId },
      payment_intent_data: {
        metadata: { orderId: params.orderId },
      },
    });

    if (
      session.amount_total != null &&
      session.amount_total !== params.amount
    ) {
      this.logger.error(
        `Stripe amount_total ${session.amount_total} !== order total ${params.amount} for ${params.orderId}`,
      );
      throw new ForbiddenException("Payment amount mismatch");
    }

    return session;
  }

  async retrieveSession(sessionId: string) {
    const stripe = this.client();
    if (!stripe || sessionId.startsWith("cs_test_mock_")) {
      if (sessionId.startsWith("cs_test_mock_") && !allowMockPayments()) {
        throw new ForbiddenException("Mock payments are disabled");
      }
      return {
        id: sessionId,
        url: null as string | null,
        payment_status: "paid" as const,
      };
    }
    return stripe.checkout.sessions.retrieve(sessionId);
  }

  async createPaymentIntent(params: {
    orderId: string;
    amount: number;
    currency: string;
    email: string;
  }) {
    const stripe = this.client();
    if (!stripe) {
      const mockId = `pi_test_mock_${params.orderId}`;
      return {
        id: mockId,
        client_secret: `${mockId}_secret_mock`,
      };
    }

    return stripe.paymentIntents.create({
      amount: params.amount,
      currency: params.currency.toLowerCase(),
      receipt_email: params.email,
      automatic_payment_methods: { enabled: true },
      metadata: { orderId: params.orderId },
    });
  }

  async retrievePaymentIntent(paymentIntentId: string) {
    const stripe = this.client();
    if (!stripe || paymentIntentId.startsWith("pi_test_mock_")) {
      if (
        paymentIntentId.startsWith("pi_test_mock_") &&
        !allowMockPayments()
      ) {
        throw new ForbiddenException("Mock payments are disabled");
      }
      return {
        id: paymentIntentId,
        client_secret: `${paymentIntentId}_secret_mock` as string | null,
        status: "requires_payment_method" as const,
      };
    }
    return stripe.paymentIntents.retrieve(paymentIntentId);
  }

  private paymentIntentId(session: Stripe.Checkout.Session): string | undefined {
    return typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;
  }

  private async markPaidFromSession(session: Stripe.Checkout.Session) {
    const orderId = session.metadata?.orderId;
    if (!orderId) return;
    if (session.payment_status !== "paid") {
      this.logger.log(
        `Session ${session.id} completed with payment_status=${session.payment_status}; waiting for paid`,
      );
      return;
    }
    await this.orders.markPaid(orderId, {
      stripeSessionId: session.id,
      stripePaymentIntentId: this.paymentIntentId(session),
    });
  }

  private async markPaidFromPaymentIntent(pi: Stripe.PaymentIntent) {
    const orderId = pi.metadata?.orderId;
    if (!orderId) return;
    if (pi.status !== "succeeded") {
      this.logger.log(
        `PaymentIntent ${pi.id} status=${pi.status}; waiting for succeeded`,
      );
      return;
    }
    await this.orders.markPaid(orderId, {
      stripePaymentIntentId: pi.id,
    });
  }

  async handleWebhook(rawBody: Buffer, signature: string) {
    if (!this.stripe) {
      this.logger.warn("Stripe not configured; ignoring webhook");
      return { received: true };
    }
    const stripe = this.stripe;

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        rawBody,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET ?? "",
      );
    } catch (e) {
      this.logger.warn("Invalid Stripe webhook signature");
      throw new BadRequestException(
        e instanceof Error ? e.message : "Invalid signature",
      );
    }

    const existing = await this.prisma.stripeEvent.findUnique({
      where: { id: event.id },
    });
    if (existing?.processed) return { received: true };

    await this.prisma.stripeEvent.upsert({
      where: { id: event.id },
      create: { id: event.id, type: event.type },
      update: {},
    });

    try {
      switch (event.type) {
        case "checkout.session.completed":
        case "checkout.session.async_payment_succeeded": {
          const session = event.data.object as Stripe.Checkout.Session;
          await this.markPaidFromSession(session);
          break;
        }
        case "checkout.session.async_payment_failed":
        case "checkout.session.expired": {
          const session = event.data.object as Stripe.Checkout.Session;
          const orderId = session.metadata?.orderId;
          if (orderId) await this.orders.expirePending(orderId);
          break;
        }
        case "payment_intent.succeeded": {
          const pi = event.data.object as Stripe.PaymentIntent;
          await this.markPaidFromPaymentIntent(pi);
          break;
        }
        case "payment_intent.payment_failed":
        case "payment_intent.canceled": {
          const pi = event.data.object as Stripe.PaymentIntent;
          const orderId = pi.metadata?.orderId;
          if (orderId) await this.orders.expirePending(orderId);
          break;
        }
        default:
          break;
      }
    } catch (e) {
      Sentry.captureException(e, { tags: { stripeEvent: event.type } });
      throw e;
    }

    await this.prisma.stripeEvent.update({
      where: { id: event.id },
      data: { processed: true },
    });

    return { received: true };
  }

  async refund(
    orderId: string,
    opts?: { amount?: number; reason?: string },
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order) throw new BadRequestException("Order not found");

    const remaining = order.total - order.refundedTotal;
    const amount = opts?.amount ?? remaining;
    if (amount <= 0 || amount > remaining) {
      throw new BadRequestException("Invalid refund amount");
    }

    if (order.stripePaymentIntentId && this.stripe) {
      await this.stripe.refunds.create(
        {
          payment_intent: order.stripePaymentIntentId,
          amount,
        },
        { idempotencyKey: `refund-${orderId}-${order.refundedTotal}-${amount}` },
      );
    } else if (order.stripePaymentIntentId && !this.stripe) {
      if (!allowMockPayments()) {
        throw new ForbiddenException("Stripe required to refund this order");
      }
    }

    return this.orders.markRefunded(orderId, {
      amount,
      note: opts?.reason,
    });
  }

  /** Customer charged but stock gone — refund full amount and leave order refunded. */
  async refundAfterStockFailure(orderId: string, note: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return;

    try {
      if (order.stripePaymentIntentId && this.stripe) {
        await this.stripe.refunds.create(
          { payment_intent: order.stripePaymentIntentId },
          { idempotencyKey: `stock-fail-refund-${orderId}` },
        );
      }
    } catch (e) {
      this.logger.error(`Auto-refund failed for ${orderId}`, e);
      Sentry.captureException(e, {
        tags: { orderId, reason: "stock_fail_refund" },
      });
    }

    // Order may still be pending_payment if claim rolled back
    if (order.status === "pending_payment") {
      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          status: "refunded",
          refundedTotal: order.total,
          transitions: {
            create: {
              fromStatus: "pending_payment",
              toStatus: "refunded",
              actorType: "system",
              note: `Auto-refund: ${note}`,
            },
          },
          auditLogs: {
            create: {
              action: "order.stock_fail_refund",
              entity: "Order",
              entityId: orderId,
              actorType: "system",
              meta: { note },
            },
          },
        },
      });
      return;
    }

    await this.orders.markRefunded(orderId, {
      amount: order.total - order.refundedTotal,
      restock: false,
      note: `Auto-refund: ${note}`,
    });
  }

  /** Dev-only helper when Stripe keys are not configured. */
  async completeMockSession(sessionId: string) {
    if (!allowMockPayments()) {
      throw new ForbiddenException("Mock payments are disabled");
    }
    if (!sessionId.startsWith("cs_test_mock_")) {
      return { ok: false };
    }
    const orderId = sessionId.replace("cs_test_mock_", "");
    await this.orders.markPaid(orderId, {
      stripeSessionId: sessionId,
      stripePaymentIntentId: `pi_mock_${orderId}`,
    });
    return { ok: true, orderId };
  }

  /** Dev-only helper for express PaymentIntent mock path. */
  async completeMockPaymentIntent(paymentIntentId: string) {
    if (!allowMockPayments()) {
      throw new ForbiddenException("Mock payments are disabled");
    }
    if (!paymentIntentId.startsWith("pi_test_mock_")) {
      return { ok: false };
    }
    const orderId = paymentIntentId.replace("pi_test_mock_", "");
    await this.orders.markPaid(orderId, {
      stripePaymentIntentId: paymentIntentId,
    });
    return { ok: true, orderId };
  }
}
