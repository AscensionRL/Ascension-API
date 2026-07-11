import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { PublicUser, toPublicUser, User } from '../users/user.entity';
import {
  OnboardingEmailDto,
  OnboardingEpicDto,
  OnboardingPasswordDto,
  OnboardingUsernameDto,
} from './dto/onboarding.dto';
import { OnboardingService } from './onboarding.service';

@Controller('onboarding')
@UseGuards(AuthGuard)
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  @Post('email')
  async email(
    @CurrentUser() user: User,
    @Body() dto: OnboardingEmailDto,
  ): Promise<PublicUser> {
    return toPublicUser(await this.onboarding.setEmail(user, dto.email));
  }

  @Post('username')
  async username(
    @CurrentUser() user: User,
    @Body() dto: OnboardingUsernameDto,
  ): Promise<PublicUser> {
    return toPublicUser(await this.onboarding.setUsername(user, dto.username));
  }

  @Post('epic')
  async epic(
    @CurrentUser() user: User,
    @Body() dto: OnboardingEpicDto,
  ): Promise<PublicUser> {
    return toPublicUser(await this.onboarding.setEpicName(user, dto.epicName));
  }

  @Post('password')
  async password(
    @CurrentUser() user: User,
    @Body() dto: OnboardingPasswordDto,
  ): Promise<PublicUser> {
    return toPublicUser(await this.onboarding.setPassword(user, dto.password));
  }
}
