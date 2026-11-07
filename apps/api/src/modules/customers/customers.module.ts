import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { CustomerJwtGuard } from "../../common/guards/customer-jwt.guard.js";
import { CustomersController } from "./customers.controller.js";
import { CustomersService } from "./customers.service.js";

@Module({
  imports: [JwtModule.register({})],
  controllers: [CustomersController],
  providers: [CustomersService, CustomerJwtGuard],
  exports: [CustomersService],
})
export class CustomersModule {}
