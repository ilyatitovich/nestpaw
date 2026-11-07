import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { Public } from "../../common/decorators/public.decorator";
import { PrismaService } from "../../prisma/prisma.service";
import { RedisService } from "../../redis/redis.service";

@Controller("health")
export class HealthController {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  @Public()
  @Get("live")
  live() {
    return { status: "ok" };
  }

  @Public()
  @Get("ready")
  async ready() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      const pong = await this.redis.client.ping();
      if (pong !== "PONG") throw new Error("redis down");
      return { status: "ready" };
    } catch {
      throw new ServiceUnavailableException("not ready");
    }
  }
}
