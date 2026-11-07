import { ForbiddenException, Injectable } from "@nestjs/common";
import { z } from "zod";
import { PrismaService } from "../../prisma/prisma.service.js";

const CurrencyRateSchema = z.object({
  code: z.string().length(3),
  rateToEur: z.number().positive(),
});

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  async getPublic() {
    const settings = await this.prisma.storeSetting.findMany();
    const map = Object.fromEntries(
      settings.map((s) => [s.key, s.value]),
    ) as Record<string, unknown>;
    const rates =
      process.env.ENABLE_MULTI_CURRENCY === "true"
        ? await this.prisma.currencyRate.findMany()
        : [];
    return {
      storeName: process.env.STORE_NAME ?? "Online Store",
      defaultLocale: process.env.STORE_DEFAULT_LOCALE ?? "en",
      defaultCurrency: process.env.STORE_DEFAULT_CURRENCY ?? "EUR",
      locales: (process.env.STORE_LOCALES ?? "en,de").split(","),
      features: {
        reviews: process.env.ENABLE_REVIEWS !== "false",
        customerAccounts: process.env.ENABLE_CUSTOMER_ACCOUNTS !== "false",
        multiCurrency: process.env.ENABLE_MULTI_CURRENCY !== "false",
      },
      currencyRates: rates,
      ...map,
    };
  }

  async set(key: string, value: unknown, role: "owner" | "staff") {
    if (key.startsWith("stripe") || key.startsWith("payment")) {
      if (role !== "owner") {
        throw new ForbiddenException("Only owner can change payment settings");
      }
    }
    return this.prisma.storeSetting.upsert({
      where: { key },
      create: { key, value: value as object },
      update: { value: value as object },
    });
  }

  upsertCurrencyRate(input: unknown) {
    const data = CurrencyRateSchema.parse(input);
    return this.prisma.currencyRate.upsert({
      where: { code: data.code.toUpperCase() },
      create: { code: data.code.toUpperCase(), rateToEur: data.rateToEur },
      update: { rateToEur: data.rateToEur },
    });
  }

  convert(
    amountEurCents: number,
    toCurrency: string,
    rates: { code: string; rateToEur: { toNumber(): number } | number }[],
  ) {
    if (toCurrency === "EUR") return amountEurCents;
    const rate = rates.find((r) => r.code === toCurrency);
    if (!rate) return amountEurCents;
    const r =
      typeof rate.rateToEur === "number"
        ? rate.rateToEur
        : Number(rate.rateToEur);
    return Math.round(amountEurCents * r);
  }
}
