import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { Public } from "../../common/decorators/public.decorator.js";
import { Roles } from "../../common/decorators/roles.decorator.js";
import { ReturnsService } from "./returns.service.js";

@Controller()
export class ReturnsController {
  constructor(private returns: ReturnsService) {}

  @Public()
  @Post("returns")
  create(@Body() body: unknown) {
    return this.returns.create(body);
  }

  @Roles("owner", "staff")
  @Get("admin/returns")
  list(@Query("status") status?: string) {
    return this.returns.list(status);
  }

  @Roles("owner", "staff")
  @Post("admin/returns/:id/:action")
  transition(
    @Param("id") id: string,
    @Param("action") action: string,
    @Body() body: { adminNote?: string },
  ) {
    const allowed = ["approved", "received", "rejected", "refunded"] as const;
    if (!allowed.includes(action as (typeof allowed)[number])) {
      throw new BadRequestException("Invalid action");
    }
    return this.returns.transition(
      id,
      action as (typeof allowed)[number],
      body?.adminNote,
    );
  }
}
