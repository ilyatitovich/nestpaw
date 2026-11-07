import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { type Request } from "express";
import { customerJwtSecret } from "../../modules/customer-auth/customer-auth.util.js";
import { PrismaService } from "../../prisma/prisma.service.js";
import { type AuthCustomer } from "../decorators/current-customer.decorator.js";

@Injectable()
export class CustomerJwtGuard implements CanActivate {
  constructor(
    private jwt: JwtService,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { customer?: AuthCustomer }>();
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Customer token required");
    }
    const token = header.slice("Bearer ".length);
    try {
      const payload = await this.jwt.verifyAsync<{
        sub: string;
        email: string;
        role?: string;
        aud?: string;
      }>(token, {
        secret: customerJwtSecret(),
      });
      if (payload.role !== "customer") {
        throw new UnauthorizedException("Customer token required");
      }
      const customer = await this.prisma.customer.findUnique({
        where: { id: payload.sub },
        select: { id: true, email: true },
      });
      if (!customer) {
        throw new UnauthorizedException("Invalid customer");
      }
      request.customer = {
        id: customer.id,
        email: customer.email,
        role: "customer",
      };
      return true;
    } catch {
      throw new UnauthorizedException("Invalid customer token");
    }
  }
}
