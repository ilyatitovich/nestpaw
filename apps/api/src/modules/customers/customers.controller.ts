import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  type AuthCustomer,
  CurrentCustomer,
} from "../../common/decorators/current-customer.decorator.js";
import { Public } from "../../common/decorators/public.decorator.js";
import { Roles } from "../../common/decorators/roles.decorator.js";
import { CustomerJwtGuard } from "../../common/guards/customer-jwt.guard.js";
import type { CustomersService } from "./customers.service.js";

@Controller()
export class CustomersController {
  constructor(private customers: CustomersService) {}

  @Public()
  @Post("customers/register")
  register(@Body() body: unknown) {
    return this.customers.register(body);
  }

  @Public()
  @Post("customers/login")
  login(@Body() body: unknown) {
    return this.customers.login(body);
  }

  @Public()
  @UseGuards(CustomerJwtGuard)
  @Get("customers/me")
  me(@CurrentCustomer() customer: AuthCustomer) {
    return this.customers.me(customer.id);
  }

  @Roles("owner", "staff")
  @Get("admin/customers")
  list() {
    return this.customers.list();
  }

  @Roles("owner")
  @Get("admin/customers/export/:email")
  export(@Param("email") email: string) {
    return this.customers.exportByEmail(email);
  }

  @Roles("owner")
  @Delete("admin/customers/:email")
  remove(@Param("email") email: string) {
    return this.customers.deleteByEmail(email);
  }

  @Public()
  @UseGuards(CustomerJwtGuard)
  @Post("customers/wishlist")
  wishlist(
    @CurrentCustomer() customer: AuthCustomer,
    @Body() body: { productId: string },
  ) {
    return this.customers.addWishlist(customer.id, body.productId);
  }
}
