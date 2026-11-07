import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
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
  @Get("products/:id/related")
  related(
    @Param("id") id: string,
    @Query("locale") locale = "en",
    @Query("take") take?: string,
  ) {
    return this.catalog.relatedProducts(
      id,
      locale,
      take ? Number(take) : 4,
    );
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

  @Public()
  @Get("collections/:locale/:slug")
  collectionBySlug(
    @Param("locale") locale: string,
    @Param("slug") slug: string,
  ) {
    return this.catalog.getCollectionBySlug(locale, slug);
  }

  @Roles("owner", "staff")
  @Get("admin/collections")
  listAdminCollections() {
    return this.catalog.listCollections();
  }

  @Roles("owner", "staff")
  @Get("admin/collections/:id")
  getAdminCollection(@Param("id") id: string) {
    return this.catalog.getCollection(id);
  }

  @Roles("owner", "staff")
  @Post("admin/collections")
  createCollection(@Body() body: unknown) {
    return this.catalog.createCollection(body);
  }

  @Roles("owner", "staff")
  @Patch("admin/collections/:id")
  updateCollection(@Param("id") id: string, @Body() body: unknown) {
    return this.catalog.updateCollection(id, body);
  }

  @Roles("owner", "staff")
  @Delete("admin/collections/:id")
  deleteCollection(@Param("id") id: string) {
    return this.catalog.deleteCollection(id);
  }

  @Roles("owner", "staff")
  @Put("admin/collections/:id/products")
  setCollectionProducts(@Param("id") id: string, @Body() body: unknown) {
    return this.catalog.setCollectionProducts(id, body);
  }
}
