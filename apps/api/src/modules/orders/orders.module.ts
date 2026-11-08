import { BullModule } from "@nestjs/bullmq";
import { forwardRef, Module } from "@nestjs/common";
import { PaymentsModule } from "../payments/payments.module.js";
import { OrdersController } from "./orders.controller.js";
import { OrdersService } from "./orders.service.js";

@Module({
  imports: [
    BullModule.registerQueue({ name: "notifications" }),
    forwardRef(() => PaymentsModule),
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
