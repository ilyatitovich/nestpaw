import { Body, Controller, Headers, Post } from "@nestjs/common";
import { Public } from "../../common/decorators/public.decorator";
import { CheckoutService } from "./checkout.service";

@Controller("checkout")
export class CheckoutController {
  constructor(private checkout: CheckoutService) {}

  @Public()
  @Post()
  create(
    @Headers("x-cart-token") token: string | undefined,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body() body: unknown,
  ) {
    return this.checkout.create(token, body, idempotencyKey);
  }
}
