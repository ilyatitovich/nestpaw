import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { CustomerJwtGuard } from "../../common/guards/customer-jwt.guard";
import { CustomersController } from "./customers.controller";
import { CustomersService } from "./customers.service";

@Module({
  imports: [JwtModule.register({})],
  controllers: [CustomersController],
  providers: [CustomersService, CustomerJwtGuard],
  exports: [CustomersService],
})
export class CustomersModule {}
