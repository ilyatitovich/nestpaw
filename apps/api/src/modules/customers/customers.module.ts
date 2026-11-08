import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { CustomerJwtGuard } from "../../common/guards/customer-jwt.guard.js";
import { NewsletterModule } from "../newsletter/newsletter.module.js";
import { CustomersController } from "./customers.controller.js";
import { CustomersService } from "./customers.service.js";

@Module({
  imports: [JwtModule.register({}), NewsletterModule],
  controllers: [CustomersController],
  providers: [CustomersService, CustomerJwtGuard],
  exports: [CustomersService],
})
export class CustomersModule {}
