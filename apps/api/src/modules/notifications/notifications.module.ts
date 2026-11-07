import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { NotificationsProcessor } from "./notifications.processor.js";
import { NotificationsService } from "./notifications.service.js";

@Module({
  imports: [BullModule.registerQueue({ name: "notifications" })],
  providers: [NotificationsService, NotificationsProcessor],
  exports: [NotificationsService],
})
export class NotificationsModule {}
