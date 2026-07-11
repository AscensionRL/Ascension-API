import {
  BadRequestException,
  Body,
  Controller,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { PublicUser, toPublicUser, User } from '../users/user.entity';
import {
  ChangeEmailDto,
  ChangePasswordDto,
  UpdateProfileDto,
} from './dto/settings.dto';
import { SettingsService } from './settings.service';

@Controller('settings')
@UseGuards(AuthGuard)
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Patch('profile')
  async updateProfile(
    @CurrentUser() user: User,
    @Body() dto: UpdateProfileDto,
  ): Promise<PublicUser> {
    return toPublicUser(await this.settings.updateProfile(user, dto));
  }

  @Post('avatar')
  @UseInterceptors(
    FileInterceptor('avatar', {
      storage: diskStorage({
        destination: './uploads/avatars',
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname).toLowerCase() || '.png';
          cb(null, `${randomUUID()}${ext}`);
        },
      }),
      limits: { fileSize: 2 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (/^image\/(png|jpe?g|webp|gif)$/.test(file.mimetype)) cb(null, true);
        else cb(new BadRequestException('Nur Bilder (PNG, JPG, WEBP, GIF) erlaubt.'), false);
      },
    }),
  )
  async uploadAvatar(
    @CurrentUser() user: User,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<PublicUser> {
    if (!file) throw new BadRequestException('Keine Bilddatei erhalten.');
    const url = `/uploads/avatars/${file.filename}`;
    return toPublicUser(await this.settings.setAvatar(user, url));
  }

  @Post('password')
  async changePassword(
    @CurrentUser() user: User,
    @Body() dto: ChangePasswordDto,
  ): Promise<PublicUser> {
    return toPublicUser(await this.settings.changePassword(user, dto));
  }

  @Post('email')
  async changeEmail(
    @CurrentUser() user: User,
    @Body() dto: ChangeEmailDto,
  ): Promise<PublicUser> {
    return toPublicUser(await this.settings.changeEmail(user, dto));
  }
}
