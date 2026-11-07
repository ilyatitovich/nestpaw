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
  CurrentCustomer,
  type AuthCustomer,
} from "../../common/decorators/current-customer.decorator";
import { Public } from "../../common/decorators/public.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { CustomerJwtGuard } from "../../common/guards/customer-jwt.guard";
import { CustomersService } from "./customers.service";

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
