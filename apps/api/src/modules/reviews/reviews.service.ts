import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { CreateReviewSchema } from "@online-store/shared-types";
import { PrismaService } from "../../prisma/prisma.service.js";

@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService) {}

  private assertEnabled() {
    if (process.env.ENABLE_REVIEWS === "false") {
      throw new ServiceUnavailableException("Reviews disabled");
    }
  }

  create(input: unknown) {
    this.assertEnabled();
    const data = CreateReviewSchema.parse(input);
    return this.prisma.review.create({
      data: {
        productId: data.productId,
        rating: data.rating,
        title: data.title,
        body: data.body,
        authorName: data.authorName,
        authorEmail: data.authorEmail,
        status: "pending",
      },
    });
  }

  listPending() {
    return this.prisma.review.findMany({
      where: { status: "pending" },
      include: { product: { include: { translations: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  async moderate(id: string, status: "approved" | "rejected") {
    try {
      return await this.prisma.review.update({
        where: { id },
        data: { status },
      });
    } catch {
      throw new NotFoundException("Review not found");
    }
  }
}
