import { ForbiddenException, Injectable } from "@nestjs/common";
import {
  CustomerOtpRequestSchema,
  CustomerOtpVerifySchema,
} from "@online-store/shared-types";
import { type Request, type Response } from "express";
import { PrismaService } from "../../prisma/prisma.service.js";
import { TurnstileService } from "../newsletter/turnstile.service.js";
import { storefrontBaseUrl } from "./customer-auth.util.js";
import {
  CustomerOAuthService,
  newCodeVerifier,
  newOAuthState,
  type OAuthProvider,
} from "./customer-oauth.service.js";
import { CustomerOtpService } from "./customer-otp.service.js";
import { CustomerSessionService } from "./customer-session.service.js";

const OAUTH_COOKIE = "customerOAuth";
const OAUTH_COOKIE_PATH = "/customers/auth/oauth";

@Injectable()
export class CustomerAuthService {
  constructor(
    private prisma: PrismaService,
    private otp: CustomerOtpService,
    private oauth: CustomerOAuthService,
    private sessions: CustomerSessionService,
    private turnstile: TurnstileService,
  ) {}

  accountsEnabled() {
    return process.env.ENABLE_CUSTOMER_ACCOUNTS !== "false";
  }

  assertAccountsEnabled() {
    if (!this.accountsEnabled()) {
      throw new ForbiddenException("Customer accounts disabled");
    }
  }

  async requestOtp(input: unknown, req: Request) {
    this.assertAccountsEnabled();
    const data = CustomerOtpRequestSchema.parse(input);
    const ip =
      (req.headers["x-forwarded-for"] as string | undefined)
        ?.split(",")[0]
        ?.trim() || req.ip;
    const valid = await this.turnstile.verify(data.turnstileToken, ip);
    if (!valid) {
      throw new ForbiddenException("Bot verification failed");
    }

    // Always return ok after validation to avoid account enumeration.
    try {
      await this.otp.request({
        email: data.email,
        locale: data.locale,
        ip,
        userAgent: req.headers["user-agent"],
      });
    } catch (e) {
      if (e instanceof ForbiddenException) throw e;
      // Re-throw rate limits; swallow unexpected send failures after logging via notifications.
      throw e;
    }
    return { ok: true };
  }

  async verifyOtp(input: unknown, res: Response) {
    this.assertAccountsEnabled();
    const data = CustomerOtpVerifySchema.parse(input);
    const emailNormalized = await this.otp.verify(data.email, data.code);
    const customer = await this.upsertEmailCustomer(
      emailNormalized,
      data.email,
    );
    return this.sessions.issueSession(customer.id, customer.email, res);
  }

  startOAuth(provider: OAuthProvider, res: Response, locale?: string) {
    this.assertAccountsEnabled();
    const state = newOAuthState();
    const codeVerifier = newCodeVerifier();
    const url = this.oauth.buildAuthorizationUrl(provider, state, codeVerifier);
    const payload = Buffer.from(
      JSON.stringify({ state, codeVerifier, locale: locale || "en" }),
    ).toString("base64url");
    res.cookie(OAUTH_COOKIE, payload, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.COOKIE_SECURE === "true",
      path: OAUTH_COOKIE_PATH,
      maxAge: 10 * 60 * 1000,
    });
    return url;
  }

  async handleOAuthCallback(
    provider: OAuthProvider,
    query: { code?: string; state?: string; error?: string },
    req: Request,
    res: Response,
  ) {
    this.assertAccountsEnabled();
    const raw = req.cookies?.[OAUTH_COOKIE] as string | undefined;
    res.clearCookie(OAUTH_COOKIE, { path: OAUTH_COOKIE_PATH });

    const locale = this.parseOAuthCookie(raw)?.locale || "en";
    const returnTo = `${storefrontBaseUrl()}/${locale}/account`;

    if (query.error || !query.code || !query.state) {
      return `${returnTo}?authError=oauth_denied`;
    }

    const parsed = this.parseOAuthCookie(raw);
    if (!parsed || parsed.state !== query.state) {
      return `${returnTo}?authError=oauth_state`;
    }

    const profile = await this.oauth.exchangeCode(
      provider,
      query.code,
      parsed.codeVerifier,
    );
    const customer = await this.oauth.resolveCustomer(profile);
    await this.sessions.issueSession(customer.id, customer.email, res);
    return `${returnTo}?auth=ok`;
  }

  async refresh(req: Request, res: Response) {
    const token = req.cookies?.[this.sessions.cookieName()] as
      | string
      | undefined;
    if (!token) return { accessToken: null as string | null, customer: null };
    return this.sessions.refresh(token, res);
  }

  async logout(req: Request, res: Response) {
    const token = req.cookies?.[this.sessions.cookieName()] as
      | string
      | undefined;
    await this.sessions.logout(token, res);
    return { ok: true };
  }

  providers() {
    return {
      google: this.oauth.isConfigured("google"),
      apple: this.oauth.isConfigured("apple"),
    };
  }

  private parseOAuthCookie(raw?: string) {
    if (!raw) return null;
    try {
      const json = Buffer.from(raw, "base64url").toString("utf8");
      const data = JSON.parse(json) as {
        state: string;
        codeVerifier: string;
        locale?: string;
      };
      if (!data.state || !data.codeVerifier) return null;
      return data;
    } catch {
      return null;
    }
  }

  private async upsertEmailCustomer(emailNormalized: string, rawEmail: string) {
    const existing = await this.prisma.customer.findUnique({
      where: { emailNormalized },
    });
    if (existing) {
      const updated = await this.prisma.customer.update({
        where: { id: existing.id },
        data: { emailVerifiedAt: existing.emailVerifiedAt ?? new Date() },
      });
      await this.prisma.customerIdentity.upsert({
        where: {
          provider_providerSubject: {
            provider: "email",
            providerSubject: emailNormalized,
          },
        },
        create: {
          provider: "email",
          providerSubject: emailNormalized,
          customerId: updated.id,
        },
        update: {},
      });
      return updated;
    }

    return this.prisma.customer.create({
      data: {
        email: rawEmail.trim(),
        emailNormalized,
        emailVerifiedAt: new Date(),
        identities: {
          create: {
            provider: "email",
            providerSubject: emailNormalized,
          },
        },
      },
    });
  }
}
