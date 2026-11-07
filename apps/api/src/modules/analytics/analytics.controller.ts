import { Body, Controller, Get, Post } from "@nestjs/common";
import { Public } from "../../common/decorators/public.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { AnalyticsService } from "./analytics.service";

@Controller()
export class AnalyticsController {
  constructor(private analytics: AnalyticsService) {}

  @Public()
  @Post("analytics/events")
  track(@Body() body: unknown) {
    return this.analytics.track(body);
  }

  @Roles("owner", "staff")
  @Get("admin/analytics/summary")
  summary() {
    return this.analytics.summary();
  }
}
