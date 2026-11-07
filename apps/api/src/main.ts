import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import * as Sentry from "@sentry/node";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { AppModule } from "./app.module.js";
import { ZodExceptionFilter } from "./common/filters/zod-exception.filter.js";
import { assertProductionSecrets } from "./modules/payments/mock-payments.js";

async function bootstrap() {
  assertProductionSecrets();

  if (process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.SENTRY_ENVIRONMENT ?? "development",
    });
  }

  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.use(helmet());
  app.use(cookieParser());
  app.useGlobalFilters(new ZodExceptionFilter());

  const allowedOrigins = new Set(
    (process.env.CORS_ORIGINS ?? "http://localhost:4321")
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean),
  );
  const isDev = process.env.NODE_ENV !== "production";
  const localhostOrigin = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      // Non-browser / same-origin requests omit Origin.
      if (!origin) {
        callback(null, true);
        return;
      }
      if (
        allowedOrigins.has(origin) ||
        (isDev && localhostOrigin.test(origin))
      ) {
        callback(null, true);
        return;
      }
      callback(new Error(`Origin ${origin} not allowed by CORS`), false);
    },
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle("Online Store API")
    .setDescription("Commerce API for the online store")
    .setVersion("1.0")
    .addBearerAuth()
    .build();
  SwaggerModule.setup("docs", app, SwaggerModule.createDocument(app, config));

  const port = Number(process.env.API_PORT ?? 3000);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`API listening on :${port}`);
}

bootstrap();
