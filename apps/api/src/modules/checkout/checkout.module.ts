import { Module } from "@nestjs/common";
import { CartModule } from "../cart/cart.module.js";
import { DiscountsModule } from "../discounts/discounts.module.js";
import { PaymentsModule } from "../payments/payments.module.js";
import { ShippingModule } from "../shipping/shipping.module.js";
import { TaxModule } from "../tax/tax.module.js";
import { CheckoutController } from "./checkout.controller.js";
import { CheckoutService } from "./checkout.service.js";

@Module({
  imports: [
    CartModule,
    PaymentsModule,
    ShippingModule,
    TaxModule,
    DiscountsModule,
  ],
  controllers: [CheckoutController],
  providers: [CheckoutService],
})
export class CheckoutModule {}
