import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import {
  CustomerRegisterSchema,
  LoginSchema,
} from "@online-store/shared-types";
import * as argon2 from "argon2";
import { PrismaService } from "../../prisma/prisma.service.js";

@Injectable()
export class CustomersService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  list() {
    return this.prisma.customer.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  async register(input: unknown) {
    if (process.env.ENABLE_CUSTOMER_ACCOUNTS === "false") {
      throw new UnauthorizedException("Customer accounts disabled");
    }
    const data = CustomerRegisterSchema.parse(input);
    const existing = await this.prisma.customer.findUnique({
      where: { email: data.email },
    });
    if (existing?.passwordHash) {
      throw new ConflictException("Email already registered");
    }
    const passwordHash = await argon2.hash(data.password);
    const customer = existing
      ? await this.prisma.customer.update({
          where: { id: existing.id },
          data: {
            passwordHash,
            firstName: data.firstName,
            lastName: data.lastName,
          },
        })
      : await this.prisma.customer.create({
          data: {
            email: data.email,
            passwordHash,
            firstName: data.firstName,
            lastName: data.lastName,
          },
        });
    return this.issueCustomerToken(customer.id, customer.email);
  }

  async login(input: unknown) {
    const { email, password } = LoginSchema.parse(input);
    const customer = await this.prisma.customer.findUnique({
      where: { email },
    });
    if (!customer?.passwordHash) {
      throw new UnauthorizedException("Invalid credentials");
    }
    const ok = await argon2.verify(customer.passwordHash, password);
    if (!ok) throw new UnauthorizedException("Invalid credentials");
    return this.issueCustomerToken(customer.id, customer.email);
  }

  async me(customerId: string) {
    return this.prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        addresses: true,
        wishlists: true,
        orders: { take: 20, orderBy: { createdAt: "desc" } },
      },
    });
  }

  async addWishlist(customerId: string, productId: string) {
    return this.prisma.wishlistItem.upsert({
      where: {
        customerId_productId: { customerId, productId },
      },
      create: { customerId, productId },
      update: {},
    });
  }

  async exportByEmail(email: string) {
    return this.prisma.customer.findUnique({
      where: { email },
      include: { addresses: true, orders: { include: { lines: true } } },
    });
  }

  async deleteByEmail(email: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { email },
    });
    if (!customer) return { ok: true };
    await this.prisma.customer.delete({ where: { id: customer.id } });
    return { ok: true };
  }

  private async issueCustomerToken(id: string, email: string) {
    const accessToken = await this.jwt.signAsync(
      { sub: id, email, role: "customer" },
      {
        secret: process.env.JWT_ACCESS_SECRET ?? "dev-access-secret",
        expiresIn: "7d",
      },
    );
    return { accessToken, customer: { id, email } };
  }
}
