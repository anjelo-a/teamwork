import { Transform, type TransformFnParams } from 'class-transformer';
import { IsString, IsUUID, MaxLength, MinLength, ValidateIf } from 'class-validator';
import {
  normalizeTaskDescription,
  normalizeTaskTitle,
  TASK_DESCRIPTION_MAX_LENGTH,
  TASK_TITLE_MAX_LENGTH,
} from '@teamwork/validation';
import { IsTaskDueDate, normalizeTaskDueDateInput } from '../task-due-date.util';

function normalizeTaskTitleValue({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? normalizeTaskTitle(value) : value;
}

function normalizeTaskDescriptionValue({ value }: TransformFnParams): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  const normalizedValue = normalizeTaskDescription(value);
  return normalizedValue === '' ? null : normalizedValue;
}

export class CreateTaskDto {
  @IsString()
  @MinLength(1)
  @MaxLength(TASK_TITLE_MAX_LENGTH)
  @Transform(normalizeTaskTitleValue)
  title!: string;

  @ValidateIf((_object, value: unknown) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(TASK_DESCRIPTION_MAX_LENGTH)
  @Transform(normalizeTaskDescriptionValue)
  description?: string | null;

  @ValidateIf((_object, value: unknown) => value !== undefined && value !== null)
  @IsUUID()
  assigneeUserId?: string | null;

  @ValidateIf((_object, value: unknown) => value !== undefined && value !== null)
  @IsString()
  @IsTaskDueDate()
  @Transform(({ value }: TransformFnParams) => normalizeTaskDueDateInput(value))
  dueDate?: string | null;
}
