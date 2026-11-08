import { Module } from "@nestjs/common";
import { PaymentsModule } from "../payments/payments.module.js";
import { ReturnsController } from "./returns.controller.js";
import { ReturnsService } from "./returns.service.js";

@Module({
  imports: [PaymentsModule],
  controllers: [ReturnsController],
  providers: [ReturnsService],
  exports: [ReturnsService],
})
export class ReturnsModule {}
