import { Injectable } from "@nestjs/common";
import { type TaxClass } from "@prisma/client";
import { z } from "zod";
import { PrismaService } from "../../prisma/prisma.service.js";
import { extractIncludedTax } from "./tax-inclusive.js";

const TaxRateSchema = z.object({
  country: z.string().length(2),
  taxClass: z.enum(["standard", "reduced"]).default("standard"),
  name: z.string().min(1),
  rateBps: z.number().int().nonnegative().max(10000),
});

@Injectable()
export class TaxService {
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.taxRate.findMany({
      orderBy: [{ country: "asc" }, { taxClass: "asc" }],
    });
  }

  upsert(input: unknown) {
    const data = TaxRateSchema.parse(input);
    const country = data.country.toUpperCase();
    const taxClass = data.taxClass as TaxClass;
    return this.prisma.taxRate.upsert({
      where: {
        country_taxClass: { country, taxClass },
      },
      create: {
        country,
        taxClass,
        name: data.name,
        rateBps: data.rateBps,
      },
      update: { name: data.name, rateBps: data.rateBps },
    });
  }

  async rateBps(country: string, taxClass: TaxClass = "standard") {
    const rate = await this.prisma.taxRate.findUnique({
      where: {
        country_taxClass: {
          country: country.toUpperCase(),
          taxClass,
        },
      },
    });
    return rate?.rateBps ?? 0;
  }

  /** VAT included in a gross amount for the given country/class. */
  async extractFromGross(
    country: string,
    grossCents: number,
    taxClass: TaxClass = "standard",
  ) {
    if (process.env.STRIPE_TAX_ENABLED === "true") return 0;
    const rateBps = await this.rateBps(country, taxClass);
    return extractIncludedTax(grossCents, rateBps);
  }
}
