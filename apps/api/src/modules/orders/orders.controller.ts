import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Query,
  Res,
} from "@nestjs/common";
import { FulfillOrderSchema, RefundOrderSchema } from "@online-store/shared-types";
import { type Response } from "express";
import {
  type AuthUser,
  CurrentUser,
} from "../../common/decorators/current-user.decorator.js";
import { Roles } from "../../common/decorators/roles.decorator.js";
import { PaymentsService } from "../payments/payments.service.js";
import { OrdersService } from "./orders.service.js";

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
  @Get(":id/invoice.pdf")
  @Header("Content-Type", "application/pdf")
  async invoice(
    @Param("id") id: string,
    @Res({ passthrough: false }) res: Response,
  ) {
    const pdf = await this.orders.invoicePdf(id);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="invoice-${id}.pdf"`,
    );
    res.send(pdf);
  }

  @Roles("owner", "staff")
  @Post(":id/fulfill")
  fulfill(
    @Param("id") id: string,
    @CurrentUser() user: AuthUser,
    @Body() body: unknown,
  ) {
    const data = FulfillOrderSchema.parse(body ?? {});
    return this.orders.fulfill(id, user.id, data);
  }

  @Roles("owner", "staff")
  @Post(":id/cancel")
  cancel(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.orders.cancel(id, user.id);
  }

  @Roles("owner")
  @Post(":id/refund")
  refund(@Param("id") id: string, @Body() body: unknown) {
    const data = RefundOrderSchema.parse(body ?? {});
    return this.payments.refund(id, data);
  }
}
