import { Injectable, NotFoundException } from "@nestjs/common";
import {
  CustomerProfileUpdateSchema,
  LocaleSchema,
} from "@online-store/shared-types";
import { z } from "zod";
import { PrismaService } from "../../prisma/prisma.service.js";
import { NewsletterService } from "../newsletter/newsletter.service.js";

const customerPublicSelect = {
  id: true,
  email: true,
  emailNormalized: true,
  emailVerifiedAt: true,
  firstName: true,
  lastName: true,
  phone: true,
  createdAt: true,
  updatedAt: true,
} as const;

const NewsletterOptInSchema = z.object({
  locale: LocaleSchema.default("en"),
});

@Injectable()
export class CustomersService {
  constructor(
    private prisma: PrismaService,
    private newsletter: NewsletterService,
  ) {}

  list() {
    return this.prisma.customer.findMany({
      select: customerPublicSelect,
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  async me(customerId: string) {
    return this.prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        ...customerPublicSelect,
        addresses: true,
        wishlists: {
          select: {
            id: true,
            productId: true,
            createdAt: true,
          },
        },
        orders: {
          take: 20,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            number: true,
            status: true,
            total: true,
            currency: true,
            createdAt: true,
          },
        },
      },
    });
  }

  async updateProfile(customerId: string, input: unknown) {
    const data = CustomerProfileUpdateSchema.parse(input);
    return this.prisma.customer.update({
      where: { id: customerId },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
      },
      select: customerPublicSelect,
    });
  }

  async optInNewsletter(customerId: string, input: unknown) {
    const data = NewsletterOptInSchema.parse(input ?? {});
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { email: true },
    });
    if (!customer) throw new NotFoundException("Customer not found");
    return this.newsletter.subscribeVerifiedEmail(customer.email, data.locale);
  }

  async addWishlist(customerId: string, productId: string) {
    return this.prisma.wishlistItem.upsert({
      where: {
        customerId_productId: { customerId, productId },
      },
      create: { customerId, productId },
      update: {},
      select: {
        id: true,
        productId: true,
        createdAt: true,
      },
    });
  }

  async exportByEmail(email: string) {
    return this.prisma.customer.findUnique({
      where: { email },
      select: {
        ...customerPublicSelect,
        addresses: true,
        orders: {
          include: { lines: true },
        },
        identities: {
          select: {
            id: true,
            provider: true,
            providerSubject: true,
            createdAt: true,
          },
        },
      },
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
}
