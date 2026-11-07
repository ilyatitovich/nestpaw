import { type PipeTransform } from "@nestjs/common";
import { type ZodSchema } from "zod";

export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: unknown) {
    return this.schema.parse(value);
  }
}
