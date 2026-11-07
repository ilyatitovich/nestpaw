import { Body, Controller, Get, Post } from "@nestjs/common";
import {
  CurrentUser,
  type AuthUser,
} from "../../common/decorators/current-user.decorator";
import { Public } from "../../common/decorators/public.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { SettingsService } from "./settings.service";

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
