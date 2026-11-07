import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export type AuthCustomer = {
  id: string;
  email: string;
  role: "customer";
};

export const CurrentCustomer = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthCustomer | undefined => {
    const request = ctx.switchToHttp().getRequest<{
      customer?: AuthCustomer;
    }>();
    return request.customer;
  },
);
