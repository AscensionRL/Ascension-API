import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from '../users/user.entity';
import { AuthedRequest } from './auth.guard';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): User => {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    return req.user;
  },
);
