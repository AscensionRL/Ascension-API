import { forwardRef, Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { TwoFactorModule } from '../two-factor/two-factor.module';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { OAuthService } from './oauth.service';
import { SessionService } from './session.service';

@Module({
  imports: [UsersModule, forwardRef(() => TwoFactorModule)],
  controllers: [AuthController],
  providers: [AuthService, SessionService, OAuthService, AuthGuard],
  exports: [SessionService, AuthGuard],
})
export class AuthModule {}
