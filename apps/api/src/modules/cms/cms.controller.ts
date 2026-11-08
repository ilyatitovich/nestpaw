import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { Public } from "../../common/decorators/public.decorator.js";
import { Roles } from "../../common/decorators/roles.decorator.js";
import { CmsService } from "./cms.service.js";

@Controller()
export class CmsController {
  constructor(private cms: CmsService) {}

  @Public()
  @Get("pages/:locale/:slug")
  page(@Param("locale") locale: string, @Param("slug") slug: string) {
    return this.cms.getPageBySlug(locale, slug);
  }

  @Public()
  @Get("menus/:handle")
  menu(@Param("handle") handle: string) {
    return this.cms.getMenu(handle);
  }

  @Roles("owner", "staff")
  @Get("admin/pages")
  listPages() {
    return this.cms.listPages();
  }

  @Roles("owner", "staff")
  @Post("admin/pages")
  createPage(@Body() body: unknown) {
    return this.cms.createPage(body);
  }

  @Roles("owner", "staff")
  @Patch("admin/pages/:id")
  updatePage(@Param("id") id: string, @Body() body: unknown) {
    return this.cms.updatePage(id, body);
  }

  @Roles("owner", "staff")
  @Post("admin/menus")
  upsertMenu(@Body() body: unknown) {
    return this.cms.upsertMenu(body);
  }
}
