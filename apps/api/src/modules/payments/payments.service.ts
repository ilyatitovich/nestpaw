import { Inject, Injectable, Logger, forwardRef } from "@nestjs/common";
import Stripe from "stripe";
import { PrismaService } from "../../prisma/prisma.service";
import { OrdersService } from "../orders/orders.service";

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
      // Mock mode for local/dev without Stripe keys
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
    const stripe = this.client();
    if (!stripe) {
      const mockId = `cs_test_mock_${params.orderId}`;
      return {
        id: mockId,
        url: `${params.successUrl}${params.successUrl.includes("?") ? "&" : "?"}session_id=${mockId}&mock=1`,
      };
    }

    const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] =
      params.lineItems.map((li) => ({
        quantity: li.quantity,
        price_data: {
          currency: params.currency.toLowerCase(),
          unit_amount: li.amount,
          product_data: { name: li.name },
        },
      }));

    if (params.shippingAmount > 0) {
      line_items.push({
        quantity: 1,
        price_data: {
          currency: params.currency.toLowerCase(),
          unit_amount: params.shippingAmount,
          product_data: { name: "Shipping" },
        },
      });
    }
    if (params.taxAmount > 0) {
      line_items.push({
        quantity: 1,
        price_data: {
          currency: params.currency.toLowerCase(),
          unit_amount: params.taxAmount,
          product_data: { name: "Tax" },
        },
      });
    }

    return stripe.checkout.sessions.create({
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
  }

  async retrieveSession(sessionId: string) {
    const stripe = this.client();
    if (!stripe || sessionId.startsWith("cs_test_mock_")) {
      return { id: sessionId, url: null as string | null, payment_status: "paid" };
    }
    return stripe.checkout.sessions.retrieve(sessionId);
  }

  async handleWebhook(rawBody: Buffer, signature: string) {
    const stripe = this.client();
    if (!stripe) {
      this.logger.warn("Stripe not configured; ignoring webhook");
      return { received: true };
    }

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
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order?.stripePaymentIntentId) {
      return this.orders.markRefunded(orderId);
    }
    const stripe = this.client();
    if (stripe) {
      await stripe.refunds.create({
        payment_intent: order.stripePaymentIntentId,
      });
    }
    return this.orders.markRefunded(orderId);
  }

  /** Dev-only helper when Stripe keys are not configured. */
  async completeMockSession(sessionId: string) {
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
