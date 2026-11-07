import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { CustomersController } from "./customers.controller";
import { CustomersService } from "./customers.service";

@Module({
  imports: [JwtModule.register({})],
  controllers: [CustomersController],
  providers: [CustomersService],
  exports: [CustomersService],
})
export class CustomersModule {}
