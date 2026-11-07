import { Body, Controller, Delete, Get, Param, Post } from "@nestjs/common";
import { Public } from "../../common/decorators/public.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
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
  @Post("customers/wishlist")
  wishlist(@Body() body: { customerId: string; productId: string }) {
    return this.customers.addWishlist(body.customerId, body.productId);
  }
}
