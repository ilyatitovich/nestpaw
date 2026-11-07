import { createHash, randomBytes } from "node:crypto";
import { InjectQueue } from "@nestjs/bullmq";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  CreateNewsletterCampaignSchema,
  SubscribeNewsletterSchema,
} from "@online-store/shared-types";
import { type Queue } from "bullmq";
import { PrismaService } from "../../prisma/prisma.service.js";
import { RedisService } from "../../redis/redis.service.js";
import { TurnstileService } from "./turnstile.service.js";

const SUBSCRIBE_LIMIT = 5;
const SUBSCRIBE_WINDOW_SEC = 60 * 60;

@Injectable()
export class NewsletterService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private turnstile: TurnstileService,
    @InjectQueue("notifications") private notifications: Queue,
  ) {}

  private hashToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }

  private newToken() {
    return randomBytes(32).toString("hex");
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private storeUrl() {
    return (
      process.env.PUBLIC_STORE_URL ??
      process.env.STORE_URL ??
      "http://localhost:4321"
    ).replace(/\/$/, "");
  }

  private apiUrl() {
    return (process.env.API_URL ?? "http://localhost:3001").replace(/\/$/, "");
  }

  private async assertSubscribeRateLimit(ip: string) {
    const key = `newsletter:subscribe:${ip || "unknown"}`;
    const count = await this.redis.client.incr(key);
    if (count === 1) {
      await this.redis.client.expire(key, SUBSCRIBE_WINDOW_SEC);
    }
    if (count > SUBSCRIBE_LIMIT) {
      throw new BadRequestException("Too many subscription attempts");
    }
  }

  async subscribe(input: unknown, ip: string) {
    const data = SubscribeNewsletterSchema.parse(input);

    // Honeypot: pretend success so bots do not learn the field exists.
    if (data.company?.trim()) {
      return { ok: true as const };
    }

    const valid = await this.turnstile.verify(data.turnstileToken, ip);
    if (!valid) {
      throw new BadRequestException("Bot verification failed");
    }

    await this.assertSubscribeRateLimit(ip);

    const email = this.normalizeEmail(data.email);
    const existing = await this.prisma.newsletterSubscriber.findUnique({
      where: { email },
    });

    if (existing?.status === "confirmed") {
      return { ok: true as const };
    }

    const confirmToken = this.newToken();
    const unsubscribeToken = this.newToken();
    const confirmTokenHash = this.hashToken(confirmToken);
    const unsubscribeTokenHash = this.hashToken(unsubscribeToken);

    const subscriber = await this.prisma.newsletterSubscriber.upsert({
      where: { email },
      create: {
        email,
        locale: data.locale,
        status: "pending",
        confirmTokenHash,
        unsubscribeTokenHash,
        source: "storefront",
      },
      update: {
        locale: data.locale,
        status: "pending",
        confirmTokenHash,
        unsubscribeTokenHash,
        confirmedAt: null,
        unsubscribedAt: null,
      },
    });

    const confirmUrl = `${this.apiUrl()}/newsletter/confirm?token=${confirmToken}`;
    await this.notifications.add(
      "newsletter-confirm",
      {
        subscriberId: subscriber.id,
        confirmUrl,
        locale: data.locale,
      },
      { removeOnComplete: 100, removeOnFail: 50 },
    );

    return { ok: true as const };
  }

  async confirm(token: string) {
    if (!token) throw new BadRequestException("Missing token");
    const hash = this.hashToken(token);
    const subscriber = await this.prisma.newsletterSubscriber.findFirst({
      where: { confirmTokenHash: hash },
    });
    if (!subscriber) throw new NotFoundException("Invalid or expired token");

    if (subscriber.status !== "confirmed") {
      await this.prisma.newsletterSubscriber.update({
        where: { id: subscriber.id },
        data: {
          status: "confirmed",
          confirmedAt: new Date(),
          confirmTokenHash: null,
        },
      });
    }

    return {
      locale: subscriber.locale || "en",
      redirectTo: `${this.storeUrl()}/${subscriber.locale || "en"}/newsletter/confirmed`,
    };
  }

  async unsubscribe(token: string) {
    if (!token) throw new BadRequestException("Missing token");
    const hash = this.hashToken(token);
    const subscriber = await this.prisma.newsletterSubscriber.findFirst({
      where: { unsubscribeTokenHash: hash },
    });
    if (!subscriber) throw new NotFoundException("Invalid or expired token");

    await this.prisma.newsletterSubscriber.update({
      where: { id: subscriber.id },
      data: {
        status: "unsubscribed",
        unsubscribedAt: new Date(),
        confirmTokenHash: null,
      },
    });

    return {
      locale: subscriber.locale || "en",
      redirectTo: `${this.storeUrl()}/${subscriber.locale || "en"}/newsletter/unsubscribed`,
    };
  }

  listSubscribers(status?: string) {
    const allowed = ["pending", "confirmed", "unsubscribed"] as const;
    const statusFilter =
      status && (allowed as readonly string[]).includes(status)
        ? (status as (typeof allowed)[number])
        : undefined;
    return this.prisma.newsletterSubscriber.findMany({
      where: statusFilter ? { status: statusFilter } : undefined,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        locale: true,
        status: true,
        source: true,
        confirmedAt: true,
        unsubscribedAt: true,
        createdAt: true,
      },
    });
  }

  async exportSubscribersCsv(status?: string) {
    const rows = await this.listSubscribers(status);
    const header = "email,locale,status,source,confirmedAt,createdAt";
    const lines = rows.map((r) =>
      [
        r.email,
        r.locale,
        r.status,
        r.source,
        r.confirmedAt?.toISOString() ?? "",
        r.createdAt.toISOString(),
      ]
        .map((v) => `"${String(v).replaceAll('"', '""')}"`)
        .join(","),
    );
    return [header, ...lines].join("\n");
  }

  confirmedCount() {
    return this.prisma.newsletterSubscriber.count({
      where: { status: "confirmed" },
    });
  }

  listCampaigns() {
    return this.prisma.newsletterCampaign.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: { select: { id: true, email: true, name: true } },
        _count: { select: { recipients: true } },
      },
    });
  }

  async createCampaign(input: unknown, createdById: string) {
    const data = CreateNewsletterCampaignSchema.parse(input);
    const bodyText =
      data.bodyText?.trim() ||
      data.bodyHtml
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    return this.prisma.newsletterCampaign.create({
      data: {
        subject: data.subject,
        bodyHtml: data.bodyHtml,
        bodyText,
        status: "draft",
        createdById,
      },
    });
  }

  async sendCampaign(campaignId: string) {
    const campaign = await this.prisma.newsletterCampaign.findUnique({
      where: { id: campaignId },
    });
    if (!campaign) throw new NotFoundException("Campaign not found");
    if (campaign.status === "sending") {
      throw new ConflictException("Campaign is already sending");
    }
    if (campaign.status === "sent") {
      throw new ConflictException("Campaign already sent");
    }

    const subscribers = await this.prisma.newsletterSubscriber.findMany({
      where: { status: "confirmed" },
      select: { id: true },
    });

    if (subscribers.length === 0) {
      throw new BadRequestException("No confirmed subscribers");
    }

    await this.prisma.newsletterCampaign.update({
      where: { id: campaignId },
      data: { status: "sending" },
    });

    await this.prisma.newsletterCampaignRecipient.createMany({
      data: subscribers.map((s) => ({
        campaignId,
        subscriberId: s.id,
        status: "queued" as const,
      })),
      skipDuplicates: true,
    });

    // Re-queue previously failed recipients on retry.
    await this.prisma.newsletterCampaignRecipient.updateMany({
      where: { campaignId, status: "failed" },
      data: { status: "queued", error: null },
    });

    const recipients = await this.prisma.newsletterCampaignRecipient.findMany({
      where: { campaignId, status: "queued" },
      select: { id: true },
    });

    for (const recipient of recipients) {
      await this.notifications.add(
        "newsletter-campaign-recipient",
        { recipientId: recipient.id },
        {
          removeOnComplete: 200,
          removeOnFail: 100,
        },
      );
    }

    return {
      id: campaignId,
      queued: recipients.length,
    };
  }
}
