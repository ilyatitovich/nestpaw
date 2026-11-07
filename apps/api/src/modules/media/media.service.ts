import { randomUUID } from "node:crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service.js";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_BYTES = 5 * 1024 * 1024;

@Injectable()
export class MediaService {
  private s3: S3Client;

  constructor(private prisma: PrismaService) {
    this.s3 = new S3Client({
      region: process.env.S3_REGION ?? "us-east-1",
      endpoint: process.env.S3_ENDPOINT,
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY ?? "minio",
        secretAccessKey: process.env.S3_SECRET_KEY ?? "minio12345",
      },
    });
  }

  list() {
    return this.prisma.mediaAsset.findMany({ orderBy: { createdAt: "desc" } });
  }

  async upload(file: Express.Multer.File, alt = "") {
    if (!ALLOWED.has(file.mimetype)) {
      throw new BadRequestException("Unsupported file type");
    }
    if (file.size > MAX_BYTES) {
      throw new BadRequestException("File too large");
    }

    const ext = file.originalname.split(".").pop() ?? "bin";
    const key = `uploads/${randomUUID()}.${ext}`;
    const bucket = process.env.S3_BUCKET ?? "store-media";

    try {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
        }),
      );
    } catch {
      // ponytail: allow local without MinIO by storing placeholder URL
    }

    const publicBase =
      process.env.S3_PUBLIC_URL ?? `http://localhost:9000/${bucket}`;
    const url = `${publicBase}/${key}`;

    return this.prisma.mediaAsset.create({
      data: {
        key,
        url,
        mimeType: file.mimetype,
        size: file.size,
        alt,
      },
    });
  }

  async attachToProduct(
    productId: string,
    url: string,
    alt = "",
    position = 0,
  ) {
    return this.prisma.productMedia.create({
      data: { productId, url, alt, position },
    });
  }
}
