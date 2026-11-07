import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { OrderStatus } from "@prisma/client";
import type { Queue } from "bullmq";
import { PrismaService } from "../../prisma/prisma.service";
import { DiscountsService } from "../discounts/discounts.service";

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private discounts: DiscountsService,
    @InjectQueue("notifications") private notifications: Queue,
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
      include: { lines: true, transitions: true, auditLogs: true },
    });
    if (!order) throw new NotFoundException("Order not found");
    return order;
  }

  async markPaid(
    orderId: string,
    meta: { stripeSessionId?: string; stripePaymentIntentId?: string },
  ) {
    const order = await this.get(orderId);
    if (order.status !== "pending_payment") return order;

    const updated = await this.prisma.$transaction(async (tx) => {
      for (const line of order.lines) {
        if (!line.variantId) continue;
        const inv = await tx.inventoryItem.findUnique({
          where: { variantId: line.variantId },
        });
        if (inv?.policy === "deny") {
          await tx.inventoryItem.update({
            where: { variantId: line.variantId },
            data: { quantity: { decrement: line.quantity } },
          });
        } else if (inv) {
          await tx.inventoryItem.update({
            where: { variantId: line.variantId },
            data: { quantity: { decrement: line.quantity } },
          });
        }
      }

      if (order.discountCode) {
        await this.discounts.incrementUsage(order.discountCode);
      }

      return tx.order.update({
        where: { id: orderId },
        data: {
          status: "paid",
          stripeSessionId: meta.stripeSessionId ?? order.stripeSessionId,
          stripePaymentIntentId:
            meta.stripePaymentIntentId ?? order.stripePaymentIntentId,
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

    await this.notifications.add("order-paid", {
      orderId,
      email: order.email,
    });

    return updated;
  }

  async fulfill(orderId: string, actorId: string) {
    const order = await this.get(orderId);
    if (order.status !== "paid") {
      throw new BadRequestException("Only paid orders can be fulfilled");
    }
    return this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: "fulfilled",
        transitions: {
          create: {
            fromStatus: "paid",
            toStatus: "fulfilled",
            actorType: "admin",
            actorId,
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
    });
  }

  async cancel(orderId: string, actorId: string) {
    const order = await this.get(orderId);
    if (!["pending_payment", "paid"].includes(order.status)) {
      throw new BadRequestException("Cannot cancel this order");
    }
    return this.prisma.order.update({
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
  }

  async markRefunded(orderId: string) {
    const order = await this.get(orderId);
    if (!["paid", "fulfilled"].includes(order.status)) {
      throw new BadRequestException("Cannot refund this order");
    }
    return this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: "refunded",
        transitions: {
          create: {
            fromStatus: order.status,
            toStatus: "refunded",
            actorType: "admin",
          },
        },
        auditLogs: {
          create: {
            action: "order.refunded",
            entity: "Order",
            entityId: orderId,
            actorType: "admin",
          },
        },
      },
    });
  }
}
