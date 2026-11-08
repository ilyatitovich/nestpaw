import { createHash, randomBytes } from "node:crypto";
import { Injectable, Logger } from "@nestjs/common";
import nodemailer from "nodemailer";
import { PrismaService } from "../../prisma/prisma.service.js";

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

  private storeName() {
    return process.env.STORE_NAME ?? "Online Store";
  }

  private from() {
    return process.env.EMAIL_FROM ?? "store@example.com";
  }

  private apiUrl() {
    return (process.env.API_URL ?? "http://localhost:3001").replace(/\/$/, "");
  }

  private hashToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }

  async sendOrderPaid(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { lines: true },
    });
    if (!order) return;

    const lines = order.lines
      .map(
        (l) =>
          `${l.quantity}x ${l.title} — ${(l.total / 100).toFixed(2)} ${order.currency}`,
      )
      .join("\n");

    const vatNote = `VAT included: ${(order.taxTotal / 100).toFixed(2)} ${order.currency}`;
    const invoice =
      order.invoiceNumber != null ? `Invoice #${order.invoiceNumber}\n` : "";

    await this.transporter.sendMail({
      from: this.from(),
      to: order.email,
      subject: `${this.storeName()} — Order #${order.number} confirmed`,
      text: `Thanks for your order!\n\n${invoice}Order #${order.number}\n\n${lines}\n\nShipping: ${(order.shippingTotal / 100).toFixed(2)} ${order.currency}\n${vatNote}\nTotal: ${(order.total / 100).toFixed(2)} ${order.currency}`,
    });
  }

  async sendOrderShipped(orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return;
    const track = order.trackingNumber
      ? `\nCarrier: ${order.carrier ?? "—"}\nTracking: ${order.trackingNumber}`
      : "";
    await this.transporter.sendMail({
      from: this.from(),
      to: order.email,
      subject: `${this.storeName()} — Order #${order.number} shipped`,
      text: `Your order #${order.number} is on its way.${track}`,
    });
  }

  async sendAbandonedCart(cartId: string) {
    const cart = await this.prisma.cart.findUnique({
      where: { id: cartId },
      include: {
        lines: {
          include: {
            variant: {
              include: { product: { include: { translations: true } } },
            },
          },
        },
      },
    });
    if (!cart?.email || !cart.lines.length || cart.abandonedEmailSentAt) return;

    const storefront = (
      process.env.STOREFRONT_URL ?? "http://localhost:4321"
    ).replace(/\/$/, "");
    const titles = cart.lines
      .map((l) => l.variant.product.translations[0]?.title ?? l.variant.sku)
      .join(", ");

    await this.transporter.sendMail({
      from: this.from(),
      to: cart.email,
      subject: `${this.storeName()} — You left something behind`,
      text: `You still have items in your cart (${titles}).\n\nContinue checkout: ${storefront}/cart`,
    });

    await this.prisma.cart.update({
      where: { id: cartId },
      data: { abandonedEmailSentAt: new Date() },
    });
  }

  async sendCustomerOtp(params: {
    email: string;
    code: string;
    locale: string;
  }) {
    const isDe = params.locale === "de";
    const subject = isDe
      ? `${this.storeName()} — Ihr Anmeldecode`
      : `${this.storeName()} — Your sign-in code`;
    const text = isDe
      ? `Ihr Anmeldecode lautet: ${params.code}\n\nDer Code ist 10 Minuten gültig. Wenn Sie diesen Code nicht angefordert haben, ignorieren Sie diese E-Mail.`
      : `Your sign-in code is: ${params.code}\n\nThis code expires in 10 minutes. If you did not request it, you can ignore this email.`;

    try {
      await this.transporter.sendMail({
        from: this.from(),
        to: params.email,
        subject,
        text,
      });
    } catch (e) {
      this.logger.error(`Failed to send customer OTP to ${params.email}`, e);
      throw e;
    }
  }

  async sendNewsletterConfirm(params: {
    subscriberId: string;
    confirmUrl: string;
    locale: string;
  }) {
    const subscriber = await this.prisma.newsletterSubscriber.findUnique({
      where: { id: params.subscriberId },
    });
    if (!subscriber || subscriber.status === "unsubscribed") return;

    const isDe = params.locale === "de";
    const subject = isDe
      ? `${this.storeName()} — Newsletter bestätigen`
      : `${this.storeName()} — Confirm your newsletter signup`;
    const text = isDe
      ? `Bitte bestätigen Sie Ihre Anmeldung:\n\n${params.confirmUrl}\n\nWenn Sie sich nicht angemeldet haben, ignorieren Sie diese E-Mail.`
      : `Please confirm your newsletter signup:\n\n${params.confirmUrl}\n\nIf you did not subscribe, you can ignore this email.`;

    try {
      await this.transporter.sendMail({
        from: this.from(),
        to: subscriber.email,
        subject,
        text,
      });
    } catch (e) {
      this.logger.error(
        `Failed to send newsletter confirm for ${params.subscriberId}`,
        e,
      );
    }
  }

  async sendNewsletterCampaignRecipient(recipientId: string) {
    const recipient = await this.prisma.newsletterCampaignRecipient.findUnique({
      where: { id: recipientId },
      include: {
        campaign: true,
        subscriber: true,
      },
    });
    if (!recipient) return;

    if (recipient.status === "sent") return;

    if (recipient.subscriber.status !== "confirmed") {
      await this.prisma.newsletterCampaignRecipient.update({
        where: { id: recipientId },
        data: { status: "skipped", error: "Subscriber not confirmed" },
      });
      await this.maybeFinishCampaign(recipient.campaignId);
      return;
    }

    const unsubToken = randomBytes(32).toString("hex");
    await this.prisma.newsletterSubscriber.update({
      where: { id: recipient.subscriberId },
      data: { unsubscribeTokenHash: this.hashToken(unsubToken) },
    });
    const unsubUrl = `${this.apiUrl()}/newsletter/unsubscribe?token=${unsubToken}`;

    const footerHtml = `<p style="margin-top:2rem;font-size:12px;color:#666"><a href="${unsubUrl}">Unsubscribe</a></p>`;
    const footerText = `\n\nUnsubscribe: ${unsubUrl}`;

    try {
      await this.transporter.sendMail({
        from: this.from(),
        to: recipient.subscriber.email,
        subject: recipient.campaign.subject,
        html: `${recipient.campaign.bodyHtml}${footerHtml}`,
        text: `${recipient.campaign.bodyText}${footerText}`,
        headers: {
          "List-Unsubscribe": `<${unsubUrl}>`,
        },
      });
      await this.prisma.newsletterCampaignRecipient.update({
        where: { id: recipientId },
        data: { status: "sent", sentAt: new Date(), error: null },
      });
    } catch (e) {
      this.logger.error(`Failed campaign recipient ${recipientId}`, e);
      await this.prisma.newsletterCampaignRecipient.update({
        where: { id: recipientId },
        data: {
          status: "failed",
          error: e instanceof Error ? e.message : "send failed",
        },
      });
    }

    await this.maybeFinishCampaign(recipient.campaignId);
  }

  private async maybeFinishCampaign(campaignId: string) {
    const remaining = await this.prisma.newsletterCampaignRecipient.count({
      where: { campaignId, status: "queued" },
    });
    if (remaining > 0) return;

    const failed = await this.prisma.newsletterCampaignRecipient.count({
      where: { campaignId, status: "failed" },
    });
    const sent = await this.prisma.newsletterCampaignRecipient.count({
      where: { campaignId, status: "sent" },
    });

    await this.prisma.newsletterCampaign.update({
      where: { id: campaignId },
      data: {
        status: sent === 0 && failed > 0 ? "failed" : "sent",
        sentAt: new Date(),
      },
    });
  }
}
