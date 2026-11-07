import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export type AuthUser = {
  id: string;
  email: string;
  role: "owner" | "staff";
};

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser | undefined => {
    const request = ctx.switchToHttp().getRequest<{ user?: AuthUser }>();
    return request.user;
  },
);
