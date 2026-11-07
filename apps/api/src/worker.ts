import { NestFactory } from "@nestjs/core";
import { WorkerModule } from "./worker.module";

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule);
  // BullMQ processors register via Nest DI; keep process alive.
  // eslint-disable-next-line no-console
  console.log("Worker started");
  process.on("SIGTERM", async () => {
    await app.close();
    process.exit(0);
  });
}

bootstrap();
