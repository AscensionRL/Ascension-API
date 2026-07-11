import { applyDecorators } from '@nestjs/common';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export const PASSWORD_MIN_LENGTH = 6;
export const PASSWORD_MAX_LENGTH = 128;
export const PASSWORD_PATTERN = /^(?=.*\d)(?=.*[^A-Za-z0-9]).+$/;
export const PASSWORD_RULE_MESSAGE =
  'Passwort muss mindestens 6 Zeichen lang sein und eine Zahl sowie ein Sonderzeichen enthalten.';

export function IsPassword(): PropertyDecorator {
  return applyDecorators(
    IsString(),
    MinLength(PASSWORD_MIN_LENGTH, { message: PASSWORD_RULE_MESSAGE }),
    MaxLength(PASSWORD_MAX_LENGTH),
    Matches(PASSWORD_PATTERN, { message: PASSWORD_RULE_MESSAGE }),
  );
}
