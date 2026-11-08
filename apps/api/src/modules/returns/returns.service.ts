import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { CreateReturnSchema } from "@online-store/shared-types";
import { type ReturnStatus } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service.js";
import { PaymentsService } from "../payments/payments.service.js";

@Injectable()
export class ReturnsService {
  constructor(
    private prisma: PrismaService,
    private payments: PaymentsService,
  ) {}

  list(status?: string) {
    return this.prisma.returnRequest.findMany({
      where: status ? { status: status as ReturnStatus } : undefined,
      include: { order: { select: { number: true, email: true, total: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }

  async create(input: unknown) {
    const data = CreateReturnSchema.parse(input);
    const order = await this.prisma.order.findUnique({
      where: { id: data.orderId },
    });
    if (!order) throw new NotFoundException("Order not found");
    if (order.email.toLowerCase() !== data.email.toLowerCase()) {
      throw new BadRequestException("Email does not match order");
    }
    if (!["paid", "fulfilled"].includes(order.status)) {
      throw new BadRequestException("Order not eligible for return");
    }
    return this.prisma.returnRequest.create({
      data: {
        orderId: order.id,
        email: data.email,
        reason: data.reason,
      },
    });
  }

  async transition(
    id: string,
    status: "approved" | "received" | "rejected" | "refunded",
    adminNote?: string,
  ) {
    const req = await this.prisma.returnRequest.findUnique({ where: { id } });
    if (!req) throw new NotFoundException("Return not found");

    if (status === "refunded") {
      await this.payments.refund(req.orderId, {
        reason: `return:${id}`,
      });
      const order = await this.prisma.order.findUniqueOrThrow({
        where: { id: req.orderId },
      });
      return this.prisma.returnRequest.update({
        where: { id },
        data: {
          status: "refunded",
          refundAmount: order.total,
          adminNote,
        },
      });
    }

    return this.prisma.returnRequest.update({
      where: { id },
      data: { status, adminNote },
    });
  }
}
