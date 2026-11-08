import { InjectQueue } from "@nestjs/bullmq";
import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { type OrderStatus } from "@prisma/client";
import * as Sentry from "@sentry/node";
import { type Queue } from "bullmq";
import { PrismaService } from "../../prisma/prisma.service.js";
import { PaymentsService } from "../payments/payments.service.js";
import {
  decrementInventoryForLine,
  restockInventoryForLines,
} from "./inventory-ops.js";

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private prisma: PrismaService,
    @InjectQueue("notifications") private notifications: Queue,
    @Inject(forwardRef(() => PaymentsService))
    private payments: PaymentsService,
  ) {}

  list(params: { status?: string; take?: number; skip?: number }) {
    return this.prisma.order.findMany({
      where: params.status
        ? { status: params.status as OrderStatus }
        : undefined,
      include: { lines: true, transitions: { orderBy: { createdAt: "asc" } } },
      orderBy: { createdAt: "desc" },
      take: params.take ?? 50,
      skip: params.skip ?? 0,
    });
  }

  async get(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        lines: true,
        transitions: true,
        auditLogs: true,
        returnRequests: true,
      },
    });
    if (!order) throw new NotFoundException("Order not found");
    return order;
  }

  async allocateInvoiceNumber(
    tx: Parameters<Parameters<PrismaService["$transaction"]>[0]>[0],
  ): Promise<number> {
    const seq = await tx.invoiceSequence.upsert({
      where: { id: "default" },
      create: { id: "default", nextVal: 2 },
      update: { nextVal: { increment: 1 } },
    });
    return seq.nextVal - 1;
  }

  /**
   * Atomically claim pending_payment → paid, decrement stock, assign invoice.
   * On insufficient stock after a successful charge: auto-refund + cancel.
   */
  async markPaid(
    orderId: string,
    meta: { stripeSessionId?: string; stripePaymentIntentId?: string },
  ) {
    const order = await this.get(orderId);
    if (order.status !== "pending_payment") return order;

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        const claimed = await tx.order.updateMany({
          where: { id: orderId, status: "pending_payment" },
          data: {
            status: "paid",
            paidAt: new Date(),
            stripeSessionId: meta.stripeSessionId ?? order.stripeSessionId,
            stripePaymentIntentId:
              meta.stripePaymentIntentId ?? order.stripePaymentIntentId,
          },
        });
        if (claimed.count === 0) {
          return null;
        }

        for (const line of order.lines) {
          await decrementInventoryForLine(tx, line);
        }

        if (order.discountCode) {
          const discount = await tx.discountCode.findUnique({
            where: { code: order.discountCode.toUpperCase() },
          });
          if (discount) {
            if (
              discount.usageLimit != null &&
              discount.usageCount >= discount.usageLimit
            ) {
              throw new Error(`Discount usage limit reached: ${order.discountCode}`);
            }
            await tx.discountCode.update({
              where: { id: discount.id },
              data: { usageCount: { increment: 1 } },
            });
          }
        }

        const invoiceNumber = await this.allocateInvoiceNumber(tx);

        return tx.order.update({
          where: { id: orderId },
          data: {
            invoiceNumber,
            transitions: {
              create: {
                fromStatus: "pending_payment",
                toStatus: "paid",
                actorType: "system",
                note: "Stripe payment completed",
              },
            },
            auditLogs: {
              create: {
                action: "order.paid",
                entity: "Order",
                entityId: orderId,
                actorType: "system",
              },
            },
          },
          include: { lines: true },
        });
      });

      if (!updated) {
        return this.get(orderId);
      }

      await this.notifications.add(
        "order-paid",
        { orderId, email: order.email },
        {
          jobId: `order-paid-${orderId}`,
          attempts: 5,
          backoff: { type: "exponential", delay: 2000 },
        },
      );

      return updated;
    } catch (e) {
      if (e instanceof Error && e.message.startsWith("Insufficient stock")) {
        this.logger.error(
          `Paid order ${orderId} cannot be fulfilled: ${e.message}`,
        );
        Sentry.captureException(e, {
          tags: { orderId, reason: "insufficient_stock_after_pay" },
        });
        await this.payments.refundAfterStockFailure(orderId, e.message);
        return this.get(orderId);
      }
      throw e;
    }
  }

  async fulfill(
    orderId: string,
    actorId: string,
    shipment?: { carrier?: string; trackingNumber?: string },
  ) {
    const order = await this.get(orderId);
    if (order.status !== "paid") {
      throw new BadRequestException("Only paid orders can be fulfilled");
    }
    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: "fulfilled",
        carrier: shipment?.carrier,
        trackingNumber: shipment?.trackingNumber,
        shippedAt: new Date(),
        transitions: {
          create: {
            fromStatus: "paid",
            toStatus: "fulfilled",
            actorType: "admin",
            actorId,
            note: shipment?.trackingNumber
              ? `Shipped ${shipment.carrier ?? ""} ${shipment.trackingNumber}`.trim()
              : undefined,
          },
        },
        auditLogs: {
          create: {
            action: "order.fulfilled",
            entity: "Order",
            entityId: orderId,
            actorType: "admin",
            actorId,
            userId: actorId,
          },
        },
      },
      include: { lines: true },
    });

    await this.notifications.add(
      "order-shipped",
      { orderId },
      {
        jobId: `order-shipped-${orderId}`,
        attempts: 5,
        backoff: { type: "exponential", delay: 2000 },
      },
    );

    return updated;
  }

  async cancel(orderId: string, actorId: string) {
    const order = await this.get(orderId);
    if (!["pending_payment", "paid"].includes(order.status)) {
      throw new BadRequestException("Cannot cancel this order");
    }
    if (order.status === "paid") {
      // Paid cancel must move money — route through refund
      return this.payments.refund(orderId, { reason: "admin_cancel" });
    }

    return this.prisma.$transaction(async (tx) => {
      return tx.order.update({
        where: { id: orderId },
        data: {
          status: "cancelled",
          transitions: {
            create: {
              fromStatus: order.status,
              toStatus: "cancelled",
              actorType: "admin",
              actorId,
            },
          },
          auditLogs: {
            create: {
              action: "order.cancelled",
              entity: "Order",
              entityId: orderId,
              actorType: "admin",
              actorId,
              userId: actorId,
            },
          },
        },
      });
    });
  }

  async expirePending(orderId: string) {
    const result = await this.prisma.order.updateMany({
      where: { id: orderId, status: "pending_payment" },
      data: { status: "cancelled" },
    });
    if (result.count === 0) return this.get(orderId);
    await this.prisma.orderTransition.create({
      data: {
        orderId,
        fromStatus: "pending_payment",
        toStatus: "cancelled",
        actorType: "system",
        note: "Checkout session expired",
      },
    });
    return this.get(orderId);
  }

  async markRefunded(
    orderId: string,
    opts?: { amount?: number; restock?: boolean; note?: string },
  ) {
    const order = await this.get(orderId);
    if (!["paid", "fulfilled", "pending_payment"].includes(order.status)) {
      throw new BadRequestException("Cannot refund this order");
    }

    const amount = opts?.amount ?? order.total - order.refundedTotal;
    if (amount <= 0) {
      throw new BadRequestException("Nothing left to refund");
    }
    if (amount > order.total - order.refundedTotal) {
      throw new BadRequestException("Refund exceeds remaining amount");
    }

    const full = order.refundedTotal + amount >= order.total;
    const restock = opts?.restock !== false && full;

    return this.prisma.$transaction(async (tx) => {
      if (restock && ["paid", "fulfilled"].includes(order.status)) {
        await restockInventoryForLines(tx, order.lines);
      }
      return tx.order.update({
        where: { id: orderId },
        data: {
          status: full ? "refunded" : order.status,
          refundedTotal: { increment: amount },
          transitions: {
            create: {
              fromStatus: order.status,
              toStatus: full ? "refunded" : order.status,
              actorType: "admin",
              note: opts?.note ?? `Refund ${amount}`,
            },
          },
          auditLogs: {
            create: {
              action: full ? "order.refunded" : "order.partial_refund",
              entity: "Order",
              entityId: orderId,
              actorType: "admin",
              meta: { amount },
            },
          },
        },
        include: { lines: true },
      });
    });
  }

  async invoicePdf(orderId: string): Promise<Buffer> {
    const order = await this.get(orderId);
    if (!order.invoiceNumber) {
      throw new BadRequestException("Order has no invoice yet");
    }
    const { buildInvoicePdf } = await import("./invoice-pdf.js");
    return buildInvoicePdf(order);
  }
}
