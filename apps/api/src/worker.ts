import { NestFactory } from "@nestjs/core";
import * as Sentry from "@sentry/node";
import { WorkerModule } from "./worker.module.js";

async function bootstrap() {
  if (process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.SENTRY_ENVIRONMENT ?? "development",
    });
  }

  const app = await NestFactory.createApplicationContext(WorkerModule);
  // eslint-disable-next-line no-console
  console.log("Worker started");
  process.on("SIGTERM", async () => {
    await app.close();
    process.exit(0);
  });
}

bootstrap();
