import { Transform, type TransformFnParams } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { WORKSPACE_NAME_MAX_LENGTH } from '@teamwork/validation';

function normalizeWhitespace({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value;
}

export class UpdateWorkspaceDto {
  @IsString()
  @MinLength(2)
  @MaxLength(WORKSPACE_NAME_MAX_LENGTH)
  @Transform(normalizeWhitespace)
  name!: string;
}
