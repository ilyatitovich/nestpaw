import { Processor, WorkerHost } from "@nestjs/bullmq";
import { type Job } from "bullmq";
import { NotificationsService } from "./notifications.service.js";

type NotificationJob =
  | { orderId: string }
  | { subscriberId: string; confirmUrl: string; locale: string }
  | { recipientId: string };

@Processor("notifications", {
  limiter: { max: 10, duration: 1000 },
})
export class NotificationsProcessor extends WorkerHost {
  constructor(private notifications: NotificationsService) {
    super();
  }

  async process(job: Job<NotificationJob>) {
    if (job.name === "order-paid") {
      const data = job.data as { orderId: string };
      await this.notifications.sendOrderPaid(data.orderId);
      return;
    }
    if (job.name === "newsletter-confirm") {
      const data = job.data as {
        subscriberId: string;
        confirmUrl: string;
        locale: string;
      };
      await this.notifications.sendNewsletterConfirm(data);
      return;
    }
    if (job.name === "newsletter-campaign-recipient") {
      const data = job.data as { recipientId: string };
      await this.notifications.sendNewsletterCampaignRecipient(
        data.recipientId,
      );
    }
  }
}
