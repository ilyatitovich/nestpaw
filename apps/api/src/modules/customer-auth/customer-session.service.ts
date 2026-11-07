import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { type Response } from "express";
import { PrismaService } from "../../prisma/prisma.service.js";
import {
  customerJwtSecret,
  hashToken,
  newFamilyId,
  newRefreshToken,
  parseTtlDays,
} from "./customer-auth.util.js";

const REFRESH_COOKIE = "customerRefreshToken";
const COOKIE_PATH = "/customers/auth";

@Injectable()
export class CustomerSessionService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  cookieName() {
    return REFRESH_COOKIE;
  }

  cookiePath() {
    return COOKIE_PATH;
  }

  async issueSession(customerId: string, email: string, res: Response) {
    const accessToken = await this.signAccess(customerId, email);
    const refreshToken = newRefreshToken();
    const familyId = newFamilyId();
    const days = parseTtlDays(process.env.JWT_REFRESH_TTL, 7);
    await this.prisma.customerRefreshToken.create({
      data: {
        customerId,
        tokenHash: hashToken(refreshToken),
        familyId,
        expiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
      },
    });
    this.setRefreshCookie(res, refreshToken, days);
    return {
      accessToken,
      customer: { id: customerId, email },
    };
  }

  async refresh(rawToken: string | undefined, res: Response) {
    if (!rawToken) throw new UnauthorizedException("Invalid refresh token");
    const tokenHash = hashToken(rawToken);
    const stored = await this.prisma.customerRefreshToken.findUnique({
      where: { tokenHash },
      include: { customer: true },
    });
    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    await this.prisma.customerRefreshToken.delete({ where: { id: stored.id } });

    const accessToken = await this.signAccess(
      stored.customer.id,
      stored.customer.email,
    );
    const next = newRefreshToken();
    const days = parseTtlDays(process.env.JWT_REFRESH_TTL, 7);
    await this.prisma.customerRefreshToken.create({
      data: {
        customerId: stored.customerId,
        tokenHash: hashToken(next),
        familyId: stored.familyId,
        expiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
      },
    });
    this.setRefreshCookie(res, next, days);
    return {
      accessToken,
      customer: { id: stored.customer.id, email: stored.customer.email },
    };
  }

  async logout(rawToken: string | undefined, res: Response) {
    if (rawToken) {
      const tokenHash = hashToken(rawToken);
      await this.prisma.customerRefreshToken.deleteMany({
        where: { tokenHash },
      });
    }
    this.clearRefreshCookie(res);
  }

  private async signAccess(customerId: string, email: string) {
    return this.jwt.signAsync(
      { sub: customerId, email, role: "customer", aud: "customer" },
      {
        secret: customerJwtSecret(),
        expiresIn: process.env.JWT_ACCESS_TTL || "15m",
      } as Parameters<JwtService["signAsync"]>[1],
    );
  }

  private setRefreshCookie(res: Response, token: string, days: number) {
    res.cookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.COOKIE_SECURE === "true",
      path: COOKIE_PATH,
      maxAge: days * 24 * 60 * 60 * 1000,
    });
  }

  clearRefreshCookie(res: Response) {
    res.clearCookie(REFRESH_COOKIE, { path: COOKIE_PATH });
  }
}
