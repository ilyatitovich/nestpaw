import { Body, Controller, Delete, Get, Param, Post } from "@nestjs/common";
import { Roles } from "../../common/decorators/roles.decorator";
import { DiscountsService } from "./discounts.service";

@Controller("admin/discounts")
export class DiscountsController {
  constructor(private discounts: DiscountsService) {}

  @Roles("owner", "staff")
  @Get()
  list() {
    return this.discounts.list();
  }

  @Roles("owner", "staff")
  @Post()
  create(@Body() body: unknown) {
    return this.discounts.create(body);
  }

  @Roles("owner")
  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.discounts.remove(id);
  }
}
