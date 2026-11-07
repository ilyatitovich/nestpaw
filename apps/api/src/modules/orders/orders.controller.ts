import { Controller, Get, Param, Post, Query } from "@nestjs/common";
import {
  CurrentUser,
  type AuthUser,
} from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { PaymentsService } from "../payments/payments.service";
import { OrdersService } from "./orders.service";

@Controller("admin/orders")
export class OrdersController {
  constructor(
    private orders: OrdersService,
    private payments: PaymentsService,
  ) {}

  @Roles("owner", "staff")
  @Get()
  list(
    @Query("status") status?: string,
    @Query("take") take?: string,
    @Query("skip") skip?: string,
  ) {
    return this.orders.list({
      status,
      take: take ? Number(take) : undefined,
      skip: skip ? Number(skip) : undefined,
    });
  }

  @Roles("owner", "staff")
  @Get(":id")
  get(@Param("id") id: string) {
    return this.orders.get(id);
  }

  @Roles("owner", "staff")
  @Post(":id/fulfill")
  fulfill(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.orders.fulfill(id, user.id);
  }

  @Roles("owner", "staff")
  @Post(":id/cancel")
  cancel(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.orders.cancel(id, user.id);
  }

  @Roles("owner")
  @Post(":id/refund")
  refund(@Param("id") id: string) {
    return this.payments.refund(id);
  }
}
