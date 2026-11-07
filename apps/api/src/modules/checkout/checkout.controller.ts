import { Body, Controller, Headers, Post, Req } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { type Request } from "express";
import { Public } from "../../common/decorators/public.decorator.js";
import { PrismaService } from "../../prisma/prisma.service.js";
import { customerJwtSecret } from "../customer-auth/customer-auth.util.js";
import { CheckoutService } from "./checkout.service.js";

@Controller("checkout")
export class CheckoutController {
  constructor(
    private checkout: CheckoutService,
    private jwt: JwtService,
    private prisma: PrismaService,
  ) {}

  @Public()
  @Post()
  async create(
    @Headers("x-cart-token") token: string | undefined,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Headers("authorization") authorization: string | undefined,
    @Body() body: unknown,
    @Req() _req: Request,
  ) {
    const customerId = await this.resolveCustomerId(authorization);
    return this.checkout.create(token, body, idempotencyKey, customerId);
  }

  private async resolveCustomerId(
    authorization: string | undefined,
  ): Promise<string | undefined> {
    if (!authorization?.startsWith("Bearer ")) return undefined;
    try {
      const payload = await this.jwt.verifyAsync<{
        sub: string;
        role?: string;
      }>(authorization.slice("Bearer ".length), {
        secret: customerJwtSecret(),
      });
      if (payload.role !== "customer") return undefined;
      const customer = await this.prisma.customer.findUnique({
        where: { id: payload.sub },
        select: { id: true },
      });
      return customer?.id;
    } catch {
      return undefined;
    }
  }
}
