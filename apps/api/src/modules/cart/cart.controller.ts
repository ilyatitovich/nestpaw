import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Res,
} from "@nestjs/common";
import { type Response } from "express";
import { Public } from "../../common/decorators/public.decorator.js";
import { Roles } from "../../common/decorators/roles.decorator.js";
import { AbandonedCartService } from "./abandoned-cart.service.js";
import { CartService } from "./cart.service.js";

@Controller()
export class CartController {
  constructor(
    private cart: CartService,
    private abandoned: AbandonedCartService,
  ) {}

  @Roles("owner")
  @Post("admin/cart/abandoned/enqueue")
  enqueueAbandoned() {
    return this.abandoned.enqueueDue();
  }

  @Public()
  @Get("cart")
  async get(
    @Headers("x-cart-token") token: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const cart = await this.cart.getOrCreate(token);
    res.setHeader("X-Cart-Token", cart.token);
    return cart;
  }

  @Public()
  @Post("cart/items")
  async add(
    @Headers("x-cart-token") token: string | undefined,
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    const cart = await this.cart.add(token, body);
    res.setHeader("X-Cart-Token", cart.token);
    return cart;
  }

  @Public()
  @Patch("cart/items/:lineId")
  update(
    @Headers("x-cart-token") token: string,
    @Param("lineId") lineId: string,
    @Body() body: unknown,
  ) {
    return this.cart.updateLine(token, lineId, body);
  }

  @Public()
  @Post("cart/discount")
  applyDiscount(@Headers("x-cart-token") token: string, @Body() body: unknown) {
    return this.cart.applyDiscount(token, body);
  }

  @Public()
  @Delete("cart/discount")
  clearDiscount(@Headers("x-cart-token") token: string) {
    return this.cart.clearDiscount(token);
  }

  @Public()
  @Delete("cart")
  clear(@Headers("x-cart-token") token: string) {
    return this.cart.clear(token);
  }
}
