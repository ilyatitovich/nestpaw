import { Body, Controller, Get, Post } from "@nestjs/common";
import { Roles } from "../../common/decorators/roles.decorator";
import { UsersService } from "./users.service";

@Controller("admin/users")
export class UsersController {
  constructor(private users: UsersService) {}

  @Roles("owner")
  @Get()
  list() {
    return this.users.list();
  }

  @Roles("owner")
  @Post()
  create(@Body() body: unknown) {
    return this.users.create(body);
  }
}
