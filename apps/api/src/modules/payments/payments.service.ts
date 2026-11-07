import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  forwardRef,
} from "@nestjs/common";
import Stripe from "stripe";
import { PrismaService } from "../../prisma/prisma.service";
import { OrdersService } from "../orders/orders.service";
import { buildStripeLineItems } from "./build-stripe-line-items";
import { allowMockPayments } from "./mock-payments";

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private stripe: Stripe | null = null;

  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => OrdersService))
    private orders: OrdersService,
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
      taxAmount: params.taxAmount,
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

  async handleWebhook(rawBody: Buffer, signature: string) {
    if (!this.stripe) {
      this.logger.warn("Stripe not configured; ignoring webhook");
      return { received: true };
    }
    const stripe = this.stripe;

    const event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET ?? "",
    );

    const existing = await this.prisma.stripeEvent.findUnique({
      where: { id: event.id },
    });
    if (existing?.processed) return { received: true };

    await this.prisma.stripeEvent.upsert({
      where: { id: event.id },
      create: { id: event.id, type: event.type },
      update: {},
    });

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = session.metadata?.orderId;
      if (orderId) {
        await this.orders.markPaid(orderId, {
          stripeSessionId: session.id,
          stripePaymentIntentId:
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : session.payment_intent?.id,
        });
      }
    }

    await this.prisma.stripeEvent.update({
      where: { id: event.id },
      data: { processed: true },
    });

    return { received: true };
  }

  async refund(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order?.stripePaymentIntentId) {
      return this.orders.markRefunded(orderId);
    }
    if (this.stripe) {
      await this.stripe.refunds.create({
        payment_intent: order.stripePaymentIntentId,
      });
    }
    return this.orders.markRefunded(orderId);
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
}
