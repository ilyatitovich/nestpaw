import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import { type Queue } from "bullmq";
import { PrismaService } from "../../prisma/prisma.service.js";

/** Find carts with email + lines idle > 1h and queue abandoned emails. */
@Injectable()
export class AbandonedCartService {
  private readonly logger = new Logger(AbandonedCartService.name);

  constructor(
    private prisma: PrismaService,
    @InjectQueue("notifications") private notifications: Queue,
  ) {}

  async enqueueDue(olderThanMinutes = 60) {
    const cutoff = new Date(Date.now() - olderThanMinutes * 60_000);
    const carts = await this.prisma.cart.findMany({
      where: {
        email: { not: null },
        abandonedEmailSentAt: null,
        lastActivityAt: { lt: cutoff },
        lines: { some: {} },
      },
      select: { id: true },
      take: 50,
    });

    for (const cart of carts) {
      await this.notifications.add(
        "abandoned-cart",
        { cartId: cart.id },
        {
          jobId: `abandoned-${cart.id}`,
          attempts: 3,
          backoff: { type: "exponential", delay: 5000 },
        },
      );
    }
    this.logger.log(`Queued ${carts.length} abandoned-cart emails`);
    return { queued: carts.length };
  }
}
