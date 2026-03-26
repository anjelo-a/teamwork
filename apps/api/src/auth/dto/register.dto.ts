import { Transform, type TransformFnParams } from 'class-transformer';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import {
  DISPLAY_NAME_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  WORKSPACE_NAME_MAX_LENGTH,
} from '@teamwork/validation';

export class RegisterDto {
  @IsEmail()
  @Transform(trimStringValue)
  email!: string;

  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(PASSWORD_MAX_LENGTH)
  password!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(DISPLAY_NAME_MAX_LENGTH)
  @Transform(normalizeWhitespace)
  displayName!: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(WORKSPACE_NAME_MAX_LENGTH)
  @Transform(normalizeWhitespace)
  workspaceName?: string;
}

function trimStringValue({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function normalizeWhitespace({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value;
}
