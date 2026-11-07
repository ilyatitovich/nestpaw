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
import type { Response } from "express";
import { Public } from "../../common/decorators/public.decorator";
import { CartService } from "./cart.service";

@Controller("cart")
export class CartController {
  constructor(private cart: CartService) {}

  @Public()
  @Get()
  async get(
    @Headers("x-cart-token") token: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const cart = await this.cart.getOrCreate(token);
    res.setHeader("X-Cart-Token", cart.token);
    return cart;
  }

  @Public()
  @Post("items")
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
  @Patch("items/:lineId")
  update(
    @Headers("x-cart-token") token: string,
    @Param("lineId") lineId: string,
    @Body() body: unknown,
  ) {
    return this.cart.updateLine(token, lineId, body);
  }

  @Public()
  @Post("discount")
  applyDiscount(
    @Headers("x-cart-token") token: string,
    @Body() body: unknown,
  ) {
    return this.cart.applyDiscount(token, body);
  }

  @Public()
  @Delete("discount")
  clearDiscount(@Headers("x-cart-token") token: string) {
    return this.cart.clearDiscount(token);
  }
}
