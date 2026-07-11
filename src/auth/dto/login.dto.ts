import { IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {

  @IsString()
  @MinLength(3)
  @MaxLength(255)
  identifier: string;

  @IsString()
  @MinLength(1, { message: 'Bitte Passwort eingeben.' })
  @MaxLength(128)
  password: string;
}
