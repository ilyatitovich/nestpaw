import {
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import {
  generateOtpCode,
  hashOtpCode,
  normalizeEmail,
  safeEqualHex,
} from "./customer-auth.util.js";

const OTP_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ACTIVE_PER_EMAIL = 3;

@Injectable()
export class CustomerOtpService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async request(params: {
    email: string;
    locale: string;
    ip?: string;
    userAgent?: string;
  }) {
    const emailNormalized = normalizeEmail(params.email);

    const recent = await this.prisma.customerOtpChallenge.findFirst({
      where: {
        emailNormalized,
        purpose: "sign_in",
        createdAt: { gt: new Date(Date.now() - RESEND_COOLDOWN_MS) },
        consumedAt: null,
      },
      orderBy: { createdAt: "desc" },
    });
    if (recent) {
      throw new HttpException(
        "Please wait before requesting another code",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const activeCount = await this.prisma.customerOtpChallenge.count({
      where: {
        emailNormalized,
        purpose: "sign_in",
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (activeCount >= MAX_ACTIVE_PER_EMAIL) {
      await this.prisma.customerOtpChallenge.updateMany({
        where: {
          emailNormalized,
          purpose: "sign_in",
          consumedAt: null,
        },
        data: { consumedAt: new Date() },
      });
    }

    const code = generateOtpCode();
    await this.prisma.customerOtpChallenge.create({
      data: {
        emailNormalized,
        purpose: "sign_in",
        codeHash: hashOtpCode(emailNormalized, code),
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
        requestIp: params.ip,
        userAgent: params.userAgent?.slice(0, 500),
      },
    });

    await this.notifications.sendCustomerOtp({
      email: emailNormalized,
      code,
      locale: params.locale,
    });
  }

  async verify(email: string, code: string) {
    const emailNormalized = normalizeEmail(email);
    const challenge = await this.prisma.customerOtpChallenge.findFirst({
      where: {
        emailNormalized,
        purpose: "sign_in",
        consumedAt: null,
      },
      orderBy: { createdAt: "desc" },
    });

    if (!challenge || challenge.expiresAt < new Date()) {
      throw new UnauthorizedException("Invalid or expired code");
    }
    if (challenge.attempts >= challenge.maxAttempts) {
      throw new UnauthorizedException("Invalid or expired code");
    }

    const expected = challenge.codeHash;
    const actual = hashOtpCode(emailNormalized, code);
    if (!safeEqualHex(expected, actual)) {
      await this.prisma.customerOtpChallenge.update({
        where: { id: challenge.id },
        data: { attempts: { increment: 1 } },
      });
      throw new UnauthorizedException("Invalid or expired code");
    }

    await this.prisma.customerOtpChallenge.update({
      where: { id: challenge.id },
      data: { consumedAt: new Date() },
    });

    return emailNormalized;
  }
}
