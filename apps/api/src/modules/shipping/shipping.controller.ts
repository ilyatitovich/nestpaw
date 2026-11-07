import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { Public } from "../../common/decorators/public.decorator.js";
import { Roles } from "../../common/decorators/roles.decorator.js";
import type { ShippingService } from "./shipping.service.js";

@Controller()
export class ShippingController {
  constructor(private shipping: ShippingService) {}

  @Public()
  @Get("shipping/rates")
  rates(
    @Query("country") country: string,
    @Query("weightGrams") weightGrams?: string,
  ) {
    return this.shipping.ratesForCountry(
      country,
      weightGrams ? Number(weightGrams) : 0,
    );
  }

  @Roles("owner", "staff")
  @Get("admin/shipping/zones")
  listZones() {
    return this.shipping.listZones();
  }

  @Roles("owner")
  @Post("admin/shipping/zones")
  createZone(@Body() body: unknown) {
    return this.shipping.createZone(body);
  }
}
