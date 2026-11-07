import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { NewsletterController } from "./newsletter.controller.js";
import { NewsletterService } from "./newsletter.service.js";
import { TurnstileService } from "./turnstile.service.js";

@Module({
  imports: [BullModule.registerQueue({ name: "notifications" })],
  controllers: [NewsletterController],
  providers: [NewsletterService, TurnstileService],
  exports: [NewsletterService],
})
export class NewsletterModule {}
