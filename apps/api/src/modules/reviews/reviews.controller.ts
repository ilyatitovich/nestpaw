import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { Public } from "../../common/decorators/public.decorator.js";
import { Roles } from "../../common/decorators/roles.decorator.js";
import type { ReviewsService } from "./reviews.service.js";

@Controller()
export class ReviewsController {
  constructor(private reviews: ReviewsService) {}

  @Public()
  @Post("reviews")
  create(@Body() body: unknown) {
    return this.reviews.create(body);
  }

  @Roles("owner", "staff")
  @Get("admin/reviews")
  pending() {
    return this.reviews.listPending();
  }

  @Roles("owner", "staff")
  @Post("admin/reviews/:id/approve")
  approve(@Param("id") id: string) {
    return this.reviews.moderate(id, "approved");
  }

  @Roles("owner", "staff")
  @Post("admin/reviews/:id/reject")
  reject(@Param("id") id: string) {
    return this.reviews.moderate(id, "rejected");
  }
}
