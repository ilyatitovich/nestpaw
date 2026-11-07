import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
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
import { CustomersService } from "./customers.service.js";

@Controller()
export class CustomersController {
  constructor(private customers: CustomersService) {}

  @Public()
  @UseGuards(CustomerJwtGuard)
  @Get("customers/me")
  me(@CurrentCustomer() customer: AuthCustomer) {
    return this.customers.me(customer.id);
  }

  @Public()
  @UseGuards(CustomerJwtGuard)
  @Patch("customers/me")
  updateMe(@CurrentCustomer() customer: AuthCustomer, @Body() body: unknown) {
    return this.customers.updateProfile(customer.id, body);
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
