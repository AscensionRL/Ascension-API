import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { PublicUser, toPublicUser, User } from '../users/user.entity';
import { TwoFactorCodeDto } from './dto/two-factor.dto';
import { TwoFactorService } from './two-factor.service';

@Controller('2fa')
@UseGuards(AuthGuard)
export class TwoFactorController {
  constructor(private readonly twoFactor: TwoFactorService) {}

  @Post('totp/setup')
  totpSetup(
    @CurrentUser() user: User,
  ): Promise<{ qr: string; otpauth: string; secret: string }> {
    return this.twoFactor.startTotpSetup(user);
  }

  @Post('email/setup')
  async emailSetup(@CurrentUser() user: User): Promise<{ sent: true }> {
    await this.twoFactor.startEmailSetup(user);
    return { sent: true };
  }

  @Post('confirm')
  async confirm(
    @CurrentUser() user: User,
    @Body() dto: TwoFactorCodeDto,
  ): Promise<PublicUser> {
    return toPublicUser(await this.twoFactor.confirmSetup(user, dto.code));
  }

  @Post('disable')
  async disable(@CurrentUser() user: User): Promise<PublicUser> {
    return toPublicUser(await this.twoFactor.disable(user));
  }
}
