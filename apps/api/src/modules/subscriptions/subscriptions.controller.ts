import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import {
  type AuthCustomer,
  CurrentCustomer,
} from "../../common/decorators/current-customer.decorator.js";
import { Roles } from "../../common/decorators/roles.decorator.js";
import { CustomerJwtGuard } from "../../common/guards/customer-jwt.guard.js";
import { UseGuards } from "@nestjs/common";
import { Public } from "../../common/decorators/public.decorator.js";
import { SubscriptionsService } from "./subscriptions.service.js";

@Controller()
export class SubscriptionsController {
  constructor(private subscriptions: SubscriptionsService) {}

  @Roles("owner", "staff")
  @Get("admin/subscriptions")
  listAdmin() {
    return this.subscriptions.listAdmin();
  }

  @Public()
  @UseGuards(CustomerJwtGuard)
  @Get("customers/me/subscriptions")
  mine(@CurrentCustomer() customer: AuthCustomer) {
    return this.subscriptions.listForCustomer(customer.id);
  }

  @Public()
  @UseGuards(CustomerJwtGuard)
  @Post("customers/me/subscriptions")
  create(
    @CurrentCustomer() customer: AuthCustomer,
    @Body() body: unknown,
  ) {
    return this.subscriptions.create(customer.id, body);
  }

  @Public()
  @UseGuards(CustomerJwtGuard)
  @Post("customers/me/subscriptions/:id/cancel")
  cancel(
    @CurrentCustomer() customer: AuthCustomer,
    @Param("id") id: string,
  ) {
    return this.subscriptions.cancel(customer.id, id);
  }
}
