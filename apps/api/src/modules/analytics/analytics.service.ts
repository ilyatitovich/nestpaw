import { Injectable } from "@nestjs/common";
import { AnalyticsEventSchema } from "@online-store/shared-types";
import type { Prisma } from "@prisma/client";
import type { PrismaService } from "../../prisma/prisma.service.js";

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  track(input: unknown) {
    const data = AnalyticsEventSchema.parse(input);
    return this.prisma.analyticsEvent.create({
      data: {
        name: data.name,
        payload: data.payload as Prisma.InputJsonValue,
        locale: data.locale,
        sessionId: data.sessionId,
      },
    });
  }

  summary() {
    return this.prisma.analyticsEvent.groupBy({
      by: ["name"],
      _count: true,
      orderBy: { name: "asc" },
    });
  }
}
