import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { CustomerJwtGuard } from "../../common/guards/customer-jwt.guard.js";
import { SubscriptionsController } from "./subscriptions.controller.js";
import { SubscriptionsService } from "./subscriptions.service.js";

@Module({
  imports: [JwtModule.register({})],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService, CustomerJwtGuard],
})
export class SubscriptionsModule {}
