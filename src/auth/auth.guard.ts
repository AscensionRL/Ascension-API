import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { SESSION_COOKIE, SessionService } from './session.service';

export interface AuthedRequest extends Request {
  user: User;
  sessionId: string;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly sessionService: SessionService,
    private readonly usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const sid = req.cookies?.[SESSION_COOKIE];
    if (!sid) {
      throw new UnauthorizedException('Nicht angemeldet.');
    }

    const session = await this.sessionService.get(sid);
    if (!session) {
      throw new UnauthorizedException('Sitzung abgelaufen oder ungültig.');
    }

    const user = await this.usersService.findById(session.userId);
    if (!user) {

      await this.sessionService.destroy(sid);
      throw new UnauthorizedException('Benutzer nicht gefunden.');
    }

    req.user = user;
    req.sessionId = sid;
    return true;
  }
}
