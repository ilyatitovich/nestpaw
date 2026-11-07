import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { createHash, randomBytes } from "node:crypto";
import { LoginSchema } from "@online-store/shared-types";
import { PrismaService } from "../../prisma/prisma.service";

const MAX_FAILED = 5;
const LOCK_MS = 15 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async login(input: unknown) {
    const { email, password } = LoginSchema.parse(input);
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedException("Invalid credentials");

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new ForbiddenException("Account temporarily locked");
    }

    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) {
      const failedLogins = user.failedLogins + 1;
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLogins,
          lockedUntil:
            failedLogins >= MAX_FAILED
              ? new Date(Date.now() + LOCK_MS)
              : null,
        },
      });
      throw new UnauthorizedException("Invalid credentials");
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLogins: 0, lockedUntil: null },
    });

    return this.issueTokens(user.id, user.email, user.role);
  }

  async refresh(refreshToken: string) {
    const tokenHash = hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException("Invalid refresh token");
    }
    await this.prisma.refreshToken.delete({ where: { id: stored.id } });
    return this.issueTokens(
      stored.user.id,
      stored.user.email,
      stored.user.role,
    );
  }

  async logout(refreshToken?: string) {
    if (!refreshToken) return;
    const tokenHash = hashToken(refreshToken);
    await this.prisma.refreshToken.deleteMany({ where: { tokenHash } });
  }

  private async issueTokens(
    userId: string,
    email: string,
    role: "owner" | "staff",
  ) {
    const accessToken = await this.jwt.signAsync(
      { sub: userId, email, role },
      {
        secret: process.env.JWT_ACCESS_SECRET ?? "dev-access-secret",
        expiresIn: process.env.JWT_ACCESS_TTL ?? "15m",
      },
    );
    const refreshToken = randomBytes(48).toString("hex");
    const days = Number((process.env.JWT_REFRESH_TTL ?? "7d").replace("d", ""));
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
      },
    });
    return {
      accessToken,
      refreshToken,
      user: { id: userId, email, role },
    };
  }
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
