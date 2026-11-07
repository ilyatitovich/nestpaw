import { Injectable } from "@nestjs/common";
import { z } from "zod";
import type { PrismaService } from "../../prisma/prisma.service.js";

const TaxRateSchema = z.object({
  country: z.string().length(2),
  name: z.string().min(1),
  rateBps: z.number().int().nonnegative().max(10000),
});

@Injectable()
export class TaxService {
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.taxRate.findMany({ orderBy: { country: "asc" } });
  }

  upsert(input: unknown) {
    const data = TaxRateSchema.parse(input);
    return this.prisma.taxRate.upsert({
      where: { country: data.country.toUpperCase() },
      create: {
        country: data.country.toUpperCase(),
        name: data.name,
        rateBps: data.rateBps,
      },
      update: { name: data.name, rateBps: data.rateBps },
    });
  }

  async calculate(country: string, taxableAmount: number) {
    if (process.env.STRIPE_TAX_ENABLED === "true") {
      // ponytail: Stripe Tax via Checkout automatic_tax when enabled in Stripe dashboard
      return 0;
    }
    const rate = await this.prisma.taxRate.findUnique({
      where: { country: country.toUpperCase() },
    });
    if (!rate) return 0;
    return Math.floor((taxableAmount * rate.rateBps) / 10000);
  }
}
