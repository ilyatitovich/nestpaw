import { Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job } from "bullmq";
import type { NotificationsService } from "./notifications.service.js";

@Processor("notifications")
export class NotificationsProcessor extends WorkerHost {
  constructor(private notifications: NotificationsService) {
    super();
  }

  async process(job: Job<{ orderId: string }>) {
    if (job.name === "order-paid") {
      await this.notifications.sendOrderPaid(job.data.orderId);
    }
  }
}
