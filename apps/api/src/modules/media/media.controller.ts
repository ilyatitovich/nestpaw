import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { Roles } from "../../common/decorators/roles.decorator";
import { MediaService } from "./media.service";

@Controller("admin/media")
export class MediaController {
  constructor(private media: MediaService) {}

  @Roles("owner", "staff")
  @Get()
  list() {
    return this.media.list();
  }

  @Roles("owner", "staff")
  @Post("upload")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Body("alt") alt?: string,
  ) {
    return this.media.upload(file, alt);
  }

  @Roles("owner", "staff")
  @Post("products/:productId")
  attach(
    @Param("productId") productId: string,
    @Body() body: { url: string; alt?: string; position?: number },
  ) {
    return this.media.attachToProduct(
      productId,
      body.url,
      body.alt,
      body.position,
    );
  }
}
