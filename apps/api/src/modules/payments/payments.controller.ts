import { type RawBodyRequest } from "@nestjs/common";
import {
  Body,
  Controller,
  ForbiddenException,
  Headers,
  Post,
  Req,
} from "@nestjs/common";
import { type Request } from "express";
import { Public } from "../../common/decorators/public.decorator.js";
import { allowMockPayments } from "./mock-payments.js";
import { PaymentsService } from "./payments.service.js";

@Controller("payments")
export class PaymentsController {
  constructor(private payments: PaymentsService) {}

  @Public()
  @Post("webhook")
  webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers("stripe-signature") signature: string,
  ) {
    const raw = req.rawBody ?? Buffer.from("");
    return this.payments.handleWebhook(raw, signature ?? "");
  }

  @Public()
  @Post("mock-complete")
  mockComplete(@Body() body: { sessionId?: string }) {
    if (!allowMockPayments()) {
      throw new ForbiddenException("Mock payments are disabled");
    }
    return this.payments.completeMockSession(body.sessionId ?? "");
  }
}
