import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { Public } from "../../common/decorators/public.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { CatalogService } from "./catalog.service";

@Controller()
export class CatalogController {
  constructor(private catalog: CatalogService) {}

  @Public()
  @Get("products")
  listPublic(
    @Query("locale") locale?: string,
    @Query("q") q?: string,
    @Query("collection") collection?: string,
    @Query("take") take?: string,
    @Query("skip") skip?: string,
  ) {
    return this.catalog.listProducts({
      locale,
      q,
      collection,
      status: "active",
      take: take ? Number(take) : undefined,
      skip: skip ? Number(skip) : undefined,
    });
  }

  @Public()
  @Get("products/:locale/:slug")
  bySlug(@Param("locale") locale: string, @Param("slug") slug: string) {
    return this.catalog.getBySlug(locale, slug);
  }

  @Public()
  @Get("search")
  search(@Query("q") q = "", @Query("locale") locale = "en") {
    return this.catalog.search(q, locale);
  }

  @Roles("owner", "staff")
  @Get("admin/products")
  listAdmin(
    @Query("q") q?: string,
    @Query("status") status?: string,
    @Query("take") take?: string,
    @Query("skip") skip?: string,
  ) {
    return this.catalog.listProducts({
      q,
      status: status ?? undefined,
      take: take ? Number(take) : 50,
      skip: skip ? Number(skip) : 0,
      admin: true,
    });
  }

  @Roles("owner", "staff")
  @Get("admin/products/:id")
  getAdmin(@Param("id") id: string) {
    return this.catalog.getAdmin(id);
  }

  @Roles("owner", "staff")
  @Post("admin/products")
  create(@Body() body: unknown) {
    return this.catalog.create(body);
  }

  @Roles("owner", "staff")
  @Patch("admin/products/:id")
  update(@Param("id") id: string, @Body() body: unknown) {
    return this.catalog.update(id, body);
  }

  @Roles("owner", "staff")
  @Delete("admin/products/:id")
  remove(@Param("id") id: string) {
    return this.catalog.softDelete(id);
  }

  @Public()
  @Get("collections")
  collections(@Query("locale") locale?: string) {
    return this.catalog.listCollections(locale);
  }

  @Roles("owner", "staff")
  @Post("admin/collections")
  createCollection(@Body() body: unknown) {
    return this.catalog.createCollection(body);
  }
}
