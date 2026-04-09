import { Transform, type TransformFnParams } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import type {
  TaskAssignmentFilter as SharedTaskAssignmentFilter,
  TaskDueBucket as SharedTaskDueBucket,
} from '@teamwork/types';
import { IsTaskDueDate, normalizeTaskDueDateInput } from '../task-due-date.util';

const TASK_DUE_BUCKETS = ['past_due', 'today', 'upcoming', 'no_date'] as const satisfies Readonly<
  SharedTaskDueBucket[]
>;
const TASK_ASSIGNMENT_FILTERS = ['everyone', 'me', 'others', 'unassigned'] as const satisfies Readonly<
  SharedTaskAssignmentFilter[]
>;

export type TaskDueBucket = (typeof TASK_DUE_BUCKETS)[number];
export type TaskAssignmentFilter = (typeof TASK_ASSIGNMENT_FILTERS)[number];

export interface TaskListFilters {
  workspaceId?: string;
  dueBucket?: TaskDueBucket;
  assignment?: TaskAssignmentFilter;
  referenceDate?: string | null;
  limit?: number;
  cursor?: string;
}

function normalizeOptionalQueryValue({ value }: TransformFnParams): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  const normalizedValue = value.trim();
  return normalizedValue === '' ? undefined : normalizedValue;
}

function normalizeOptionalPositiveIntegerValue({ value }: TransformFnParams): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  const normalizedValue = value.trim();

  if (normalizedValue === '') {
    return undefined;
  }

  const parsedValue = Number.parseInt(normalizedValue, 10);
  return Number.isFinite(parsedValue) ? parsedValue : value;
}

function normalizeAssignmentFilterValue({ value }: TransformFnParams): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  const normalizedValue = value.trim();

  if (normalizedValue === '') {
    return undefined;
  }

  if (normalizedValue === 'all') {
    return 'everyone';
  }

  return normalizedValue;
}

export class ListTaskFiltersDto implements TaskListFilters {
  @IsOptional()
  @IsUUID()
  @Transform(normalizeOptionalQueryValue)
  workspaceId?: string;

  @IsOptional()
  @IsIn(TASK_DUE_BUCKETS)
  @Transform(normalizeOptionalQueryValue)
  dueBucket?: TaskDueBucket;

  @IsOptional()
  @IsIn(TASK_ASSIGNMENT_FILTERS)
  @Transform(normalizeAssignmentFilterValue)
  assignment?: TaskAssignmentFilter;

  @IsOptional()
  @IsTaskDueDate()
  @Transform(({ value }: TransformFnParams) => normalizeTaskDueDateInput(value))
  referenceDate?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Transform(normalizeOptionalPositiveIntegerValue)
  limit?: number;

  @IsOptional()
  @IsUUID()
  @Transform(normalizeOptionalQueryValue)
  cursor?: string;
}
