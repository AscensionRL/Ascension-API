import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { IsPassword } from '../../common/validators/password.decorator';

export class OnboardingEmailDto {
  @IsEmail({}, { message: 'Bitte eine gültige E-Mail-Adresse angeben.' })
  email: string;
}

export class OnboardingUsernameDto {
  @IsString()
  @MinLength(3, { message: 'Benutzername muss mindestens 3 Zeichen haben.' })
  @MaxLength(50)
  @Matches(/^[a-zA-Z0-9_.-]+$/, {
    message: 'Benutzername darf nur Buchstaben, Zahlen, _ . - enthalten.',
  })
  username: string;
}

export class OnboardingEpicDto {
  @IsString()
  @MinLength(2, { message: 'Epic-Name muss mindestens 2 Zeichen haben.' })
  @MaxLength(100)
  epicName: string;
}

export class OnboardingPasswordDto {
  @IsPassword()
  password: string;
}
