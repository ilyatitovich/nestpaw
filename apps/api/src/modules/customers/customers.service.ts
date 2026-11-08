import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  CustomerProfileUpdateSchema,
  LocaleSchema,
} from "@online-store/shared-types";
import { z } from "zod";
import { PrismaService } from "../../prisma/prisma.service.js";
import { NewsletterService } from "../newsletter/newsletter.service.js";

const AddressSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  line1: z.string().min(1).max(200),
  line2: z.string().max(200).optional(),
  city: z.string().min(1).max(100),
  postalCode: z.string().min(1).max(20),
  country: z.string().length(2),
  phone: z.string().max(40).optional(),
  isDefault: z.boolean().optional(),
});

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
            trackingNumber: true,
            carrier: true,
            shippedAt: true,
            invoiceNumber: true,
            lines: {
              select: {
                title: true,
                quantity: true,
                total: true,
                sku: true,
              },
            },
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

  async lookupOrder(email: string, numberRaw: string) {
    const number = Number(numberRaw);
    if (!email || !Number.isFinite(number)) {
      throw new BadRequestException("email and number required");
    }
    const order = await this.prisma.order.findFirst({
      where: {
        number,
        email: { equals: email, mode: "insensitive" },
      },
      select: {
        number: true,
        status: true,
        total: true,
        currency: true,
        createdAt: true,
        trackingNumber: true,
        carrier: true,
        shippedAt: true,
        lines: {
          select: { title: true, quantity: true, total: true, sku: true },
        },
      },
    });
    if (!order) throw new NotFoundException("Order not found");
    return order;
  }

  async addAddress(customerId: string, input: unknown) {
    const data = AddressSchema.parse(input);
    if (data.isDefault) {
      await this.prisma.customerAddress.updateMany({
        where: { customerId },
        data: { isDefault: false },
      });
    }
    return this.prisma.customerAddress.create({
      data: { customerId, ...data, country: data.country.toUpperCase() },
    });
  }

  async deleteAddress(customerId: string, addressId: string) {
    const existing = await this.prisma.customerAddress.findFirst({
      where: { id: addressId, customerId },
    });
    if (!existing) throw new NotFoundException("Address not found");
    await this.prisma.customerAddress.delete({ where: { id: addressId } });
    return { ok: true };
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
