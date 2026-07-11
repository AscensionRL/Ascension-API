import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { IsPassword } from '../../common/validators/password.decorator';

export class RegisterDto {
  @IsString()
  @MinLength(3, { message: 'Benutzername muss mindestens 3 Zeichen haben.' })
  @MaxLength(50)
  @Matches(/^[a-zA-Z0-9_.-]+$/, {
    message: 'Benutzername darf nur Buchstaben, Zahlen, _ . - enthalten.',
  })
  username: string;

  @IsEmail({}, { message: 'Bitte eine gültige E-Mail-Adresse angeben.' })
  email: string;

  @IsPassword()
  password: string;
}
