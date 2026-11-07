import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { Public } from "../../common/decorators/public.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { CmsService } from "./cms.service";

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
  @Post("admin/menus")
  upsertMenu(@Body() body: unknown) {
    return this.cms.upsertMenu(body);
  }
}
