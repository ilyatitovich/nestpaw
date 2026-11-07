import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { type Request, type Response } from "express";
import { Public } from "../../common/decorators/public.decorator.js";
import { CustomerAuthService } from "./customer-auth.service.js";
import { type OAuthProvider } from "./customer-oauth.service.js";

@Controller("customers/auth")
export class CustomerAuthController {
  constructor(private auth: CustomerAuthService) {}

  @Public()
  @Get("providers")
  providers() {
    return this.auth.providers();
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("otp/request")
  requestOtp(@Body() body: unknown, @Req() req: Request) {
    return this.auth.requestOtp(body, req);
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post("otp/verify")
  verifyOtp(@Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    return this.auth.verifyOtp(body, res);
  }

  @Public()
  @Get("oauth/:provider/start")
  startOAuth(
    @Param("provider") provider: string,
    @Query("locale") locale: string | undefined,
    @Res() res: Response,
  ) {
    const p = assertProvider(provider);
    const url = this.auth.startOAuth(p, res, locale);
    return res.redirect(url);
  }

  @Public()
  @Get("oauth/:provider/callback")
  async oauthCallback(
    @Param("provider") provider: string,
    @Query() query: { code?: string; state?: string; error?: string },
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const p = assertProvider(provider);
    const redirectTo = await this.auth.handleOAuthCallback(p, query, req, res);
    return res.redirect(redirectTo);
  }

  @Public()
  @Post("refresh")
  refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.auth.refresh(req, res);
  }

  @Public()
  @Post("logout")
  logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.auth.logout(req, res);
  }
}

function assertProvider(provider: string): OAuthProvider {
  if (provider === "google" || provider === "apple") return provider;
  throw new BadRequestException("Unknown OAuth provider");
}
