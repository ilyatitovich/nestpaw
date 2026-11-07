import { Module } from "@nestjs/common";
import { CartModule } from "../cart/cart.module";
import { DiscountsModule } from "../discounts/discounts.module";
import { PaymentsModule } from "../payments/payments.module";
import { ShippingModule } from "../shipping/shipping.module";
import { TaxModule } from "../tax/tax.module";
import { CheckoutController } from "./checkout.controller";
import { CheckoutService } from "./checkout.service";

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
