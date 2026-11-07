import { Body, Controller, Get, Post } from "@nestjs/common";
import {
  type AuthUser,
  CurrentUser,
} from "../../common/decorators/current-user.decorator.js";
import { Public } from "../../common/decorators/public.decorator.js";
import { Roles } from "../../common/decorators/roles.decorator.js";
import type { SettingsService } from "./settings.service.js";

@Controller()
export class SettingsController {
  constructor(private settings: SettingsService) {}

  @Public()
  @Get("settings")
  publicSettings() {
    return this.settings.getPublic();
  }

  @Roles("owner", "staff")
  @Post("admin/settings")
  set(
    @Body() body: { key: string; value: unknown },
    @CurrentUser() user: AuthUser,
  ) {
    return this.settings.set(body.key, body.value, user.role);
  }

  @Roles("owner")
  @Post("admin/settings/currency-rates")
  currency(@Body() body: unknown) {
    return this.settings.upsertCurrencyRate(body);
  }
}
