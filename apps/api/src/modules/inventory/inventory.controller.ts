import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { Roles } from "../../common/decorators/roles.decorator.js";
import type { InventoryService } from "./inventory.service.js";

@Controller("admin/inventory")
export class InventoryController {
  constructor(private inventory: InventoryService) {}

  @Roles("owner", "staff")
  @Get()
  list() {
    return this.inventory.list();
  }

  @Roles("owner", "staff")
  @Patch(":variantId")
  adjust(@Param("variantId") variantId: string, @Body() body: unknown) {
    return this.inventory.adjust(variantId, body);
  }

  @Roles("owner", "staff")
  @Post("bulk")
  bulk(@Body() body: { items: { variantId: string; quantity: number }[] }) {
    return this.inventory.bulkAdjust(body.items ?? []);
  }
}
