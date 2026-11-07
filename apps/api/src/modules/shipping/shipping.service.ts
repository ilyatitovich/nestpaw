import { Injectable, NotFoundException } from "@nestjs/common";
import { z } from "zod";
import { PrismaService } from "../../prisma/prisma.service";

const ZoneSchema = z.object({
  name: z.string().min(1),
  countries: z.array(z.string().length(2)).min(1),
  rates: z
    .array(
      z.object({
        name: z.string().min(1),
        price: z.number().int().nonnegative(),
        minWeightGrams: z.number().int().nonnegative().default(0),
        maxWeightGrams: z.number().int().positive().optional(),
      }),
    )
    .min(1),
});

@Injectable()
export class ShippingService {
  constructor(private prisma: PrismaService) {}

  listZones() {
    return this.prisma.shippingZone.findMany({
      include: { rates: true },
      orderBy: { name: "asc" },
    });
  }

  createZone(input: unknown) {
    const data = ZoneSchema.parse(input);
    return this.prisma.shippingZone.create({
      data: {
        name: data.name,
        countries: data.countries.map((c) => c.toUpperCase()),
        rates: { create: data.rates },
      },
      include: { rates: true },
    });
  }

  async quote(country: string, weightGrams: number) {
    const zone = await this.prisma.shippingZone.findFirst({
      where: { countries: { has: country.toUpperCase() } },
      include: { rates: true },
    });
    if (!zone) return null;
    const rate = zone.rates.find(
      (r) =>
        weightGrams >= r.minWeightGrams &&
        (r.maxWeightGrams == null || weightGrams <= r.maxWeightGrams),
    );
    return rate ?? zone.rates[0] ?? null;
  }

  async getRate(id: string) {
    const rate = await this.prisma.shippingRate.findUnique({ where: { id } });
    if (!rate) throw new NotFoundException("Shipping rate not found");
    return rate;
  }

  async ratesForCountry(country: string, weightGrams = 0) {
    const zone = await this.prisma.shippingZone.findFirst({
      where: { countries: { has: country.toUpperCase() } },
      include: { rates: true },
    });
    if (!zone) return [];
    return zone.rates.filter(
      (r) =>
        weightGrams >= r.minWeightGrams &&
        (r.maxWeightGrams == null || weightGrams <= r.maxWeightGrams),
    );
  }
}
