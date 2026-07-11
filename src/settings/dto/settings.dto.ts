import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { IsPassword } from '../../common/validators/password.decorator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'Benutzername muss mindestens 3 Zeichen haben.' })
  @MaxLength(50)
  @Matches(/^[a-zA-Z0-9_.-]+$/, {
    message: 'Benutzername darf nur Buchstaben, Zahlen, _ . - enthalten.',
  })
  username?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Epic-Name muss mindestens 2 Zeichen haben.' })
  @MaxLength(100)
  epicName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  region?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  avatarUrl?: string;
}

export class ChangePasswordDto {
  @IsString()
  @MaxLength(128)
  currentPassword: string;

  @IsPassword()
  newPassword: string;
}

export class ChangeEmailDto {
  @IsEmail({}, { message: 'Bitte gib eine gültige E-Mail-Adresse ein.' })
  @MaxLength(255)
  newEmail: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  currentPassword?: string;
}
