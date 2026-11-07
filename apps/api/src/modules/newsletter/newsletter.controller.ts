import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Query,
  Req,
  Res,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { type Request, type Response } from "express";
import {
  type AuthUser,
  CurrentUser,
} from "../../common/decorators/current-user.decorator.js";
import { Public } from "../../common/decorators/public.decorator.js";
import { Roles } from "../../common/decorators/roles.decorator.js";
import { NewsletterService } from "./newsletter.service.js";

function clientIp(req: Request) {
  const forwarded =
    req.headers["cf-connecting-ip"] ?? req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0]?.trim() || req.ip || "unknown";
  }
  return req.ip || "unknown";
}

@Controller()
export class NewsletterController {
  constructor(private newsletter: NewsletterService) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("newsletter/subscribe")
  subscribe(@Body() body: unknown, @Req() req: Request) {
    return this.newsletter.subscribe(body, clientIp(req));
  }

  @Public()
  @Get("newsletter/confirm")
  async confirm(@Query("token") token: string, @Res() res: Response) {
    const result = await this.newsletter.confirm(token);
    return res.redirect(302, result.redirectTo);
  }

  @Public()
  @Get("newsletter/unsubscribe")
  async unsubscribe(@Query("token") token: string, @Res() res: Response) {
    const result = await this.newsletter.unsubscribe(token);
    return res.redirect(302, result.redirectTo);
  }

  @Roles("owner", "staff")
  @Get("admin/newsletter/subscribers")
  listSubscribers(@Query("status") status?: string) {
    return this.newsletter.listSubscribers(status);
  }

  @Roles("owner", "staff")
  @Get("admin/newsletter/subscribers/export")
  @Header("Content-Type", "text/csv; charset=utf-8")
  @Header(
    "Content-Disposition",
    'attachment; filename="newsletter-subscribers.csv"',
  )
  exportSubscribers(@Query("status") status?: string) {
    return this.newsletter.exportSubscribersCsv(status);
  }

  @Roles("owner", "staff")
  @Get("admin/newsletter/subscribers/count")
  confirmedCount() {
    return this.newsletter.confirmedCount().then((count) => ({ count }));
  }

  @Roles("owner", "staff")
  @Get("admin/newsletter/campaigns")
  listCampaigns() {
    return this.newsletter.listCampaigns();
  }

  @Roles("owner", "staff")
  @Post("admin/newsletter/campaigns")
  createCampaign(@Body() body: unknown, @CurrentUser() user: AuthUser) {
    return this.newsletter.createCampaign(body, user.id);
  }

  @Roles("owner", "staff")
  @Post("admin/newsletter/campaigns/:id/send")
  sendCampaign(@Param("id") id: string) {
    return this.newsletter.sendCampaign(id);
  }
}
