import { IsString, Length } from 'class-validator';

export class TwoFactorCodeDto {
  @IsString()
  @Length(4, 10, { message: 'Bitte gib den Code ein.' })
  code: string;
}
