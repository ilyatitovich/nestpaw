import { Injectable, Logger } from "@nestjs/common";
import nodemailer from "nodemailer";
import type { PrismaService } from "../../prisma/prisma.service.js";

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? "localhost",
    port: Number(process.env.SMTP_PORT ?? 1025),
    secure: false,
    auth: process.env.SMTP_USER
      ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        }
      : undefined,
  });

  constructor(private prisma: PrismaService) {}

  async sendOrderPaid(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { lines: true },
    });
    if (!order) return;

    const storeName = process.env.STORE_NAME ?? "Online Store";
    const lines = order.lines
      .map(
        (l) =>
          `${l.quantity}x ${l.title} — ${(l.total / 100).toFixed(2)} ${order.currency}`,
      )
      .join("\n");

    try {
      await this.transporter.sendMail({
        from: process.env.EMAIL_FROM ?? "store@example.com",
        to: order.email,
        subject: `${storeName} — Order #${order.number} confirmed`,
        text: `Thanks for your order!\n\nOrder #${order.number}\n\n${lines}\n\nTotal: ${(order.total / 100).toFixed(2)} ${order.currency}`,
      });
    } catch (e) {
      this.logger.error(`Failed to send order email for ${orderId}`, e);
    }
  }
}
