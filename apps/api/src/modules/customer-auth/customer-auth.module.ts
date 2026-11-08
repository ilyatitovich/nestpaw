import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { NewsletterModule } from "../newsletter/newsletter.module.js";
import { TurnstileService } from "../newsletter/turnstile.service.js";
import { NotificationsModule } from "../notifications/notifications.module.js";
import { CustomerAuthController } from "./customer-auth.controller.js";
import { CustomerAuthService } from "./customer-auth.service.js";
import { CustomerOAuthService } from "./customer-oauth.service.js";
import { CustomerOtpService } from "./customer-otp.service.js";
import { CustomerSessionService } from "./customer-session.service.js";

@Module({
  imports: [JwtModule.register({}), NotificationsModule, NewsletterModule],
  controllers: [CustomerAuthController],
  providers: [
    CustomerAuthService,
    CustomerOtpService,
    CustomerOAuthService,
    CustomerSessionService,
    TurnstileService,
  ],
  exports: [CustomerSessionService, CustomerAuthService],
})
export class CustomerAuthModule {}
