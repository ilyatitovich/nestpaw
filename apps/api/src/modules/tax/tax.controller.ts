import { Body, Controller, Get, Post } from "@nestjs/common";
import { Roles } from "../../common/decorators/roles.decorator.js";
import type { TaxService } from "./tax.service.js";

@Controller("admin/tax")
export class TaxController {
  constructor(private tax: TaxService) {}

  @Roles("owner", "staff")
  @Get()
  list() {
    return this.tax.list();
  }

  @Roles("owner")
  @Post()
  upsert(@Body() body: unknown) {
    return this.tax.upsert(body);
  }
}
