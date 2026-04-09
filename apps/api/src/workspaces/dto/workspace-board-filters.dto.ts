import { Transform, type TransformFnParams } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { ListTaskFiltersDto } from '../../tasks/dto/list-task-filters.dto';

function normalizeOptionalBooleanValue({ value }: TransformFnParams): unknown {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const normalizedValue = value.trim().toLowerCase();

  if (normalizedValue === '') {
    return undefined;
  }

  if (normalizedValue === 'true' || normalizedValue === '1') {
    return true;
  }

  if (normalizedValue === 'false' || normalizedValue === '0') {
    return false;
  }

  return value;
}

export class WorkspaceBoardFiltersDto extends ListTaskFiltersDto {
  @IsOptional()
  @IsBoolean()
  @Transform(normalizeOptionalBooleanValue)
  includeMembers?: boolean;
}
