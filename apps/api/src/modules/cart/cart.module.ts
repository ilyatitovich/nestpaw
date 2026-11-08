import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { DiscountsModule } from "../discounts/discounts.module.js";
import { AbandonedCartService } from "./abandoned-cart.service.js";
import { CartController } from "./cart.controller.js";
import { CartService } from "./cart.service.js";

@Module({
  imports: [
    DiscountsModule,
    BullModule.registerQueue({ name: "notifications" }),
  ],
  controllers: [CartController],
  providers: [CartService, AbandonedCartService],
  exports: [CartService, AbandonedCartService],
})
export class CartModule {}

