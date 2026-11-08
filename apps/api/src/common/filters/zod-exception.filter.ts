import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import * as Sentry from "@sentry/node";
import { ZodError } from "zod";

@Catch()
export class ZodExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ZodExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<{
      status: (code: number) => { json: (body: unknown) => void };
    }>();

    if (exception instanceof ZodError) {
      return response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        message: exception.issues.map((e) => e.message),
        code: "VALIDATION_ERROR",
      });
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      if (status >= 500) {
        Sentry.captureException(exception);
        this.logger.error(exception);
      }
      return response
        .status(status)
        .json(
          typeof body === "string"
            ? { statusCode: status, message: body }
            : body,
        );
    }

    Sentry.captureException(exception);
    this.logger.error(exception);
    return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: "Internal server error",
    });
  }
}
