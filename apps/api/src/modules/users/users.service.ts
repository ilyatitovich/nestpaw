import { ConflictException, Injectable } from "@nestjs/common";
import * as argon2 from "argon2";
import { z } from "zod";
import type { PrismaService } from "../../prisma/prisma.service.js";

const CreateStaffSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  role: z.enum(["owner", "staff"]).default("staff"),
});

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        lockedUntil: true,
      },
      orderBy: { createdAt: "asc" },
    });
  }

  async create(input: unknown) {
    const data = CreateStaffSchema.parse(input);
    const existing = await this.prisma.user.findUnique({
      where: { email: data.email },
    });
    if (existing) throw new ConflictException("Email taken");
    const passwordHash = await argon2.hash(data.password);
    return this.prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        role: data.role,
        passwordHash,
      },
      select: { id: true, email: true, name: true, role: true },
    });
  }
}
