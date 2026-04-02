import { Transform, type TransformFnParams } from 'class-transformer';
import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { IsTaskDueDate, normalizeTaskDueDateInput } from '../task-due-date.util';

const TASK_DUE_BUCKETS = ['past_due', 'today', 'upcoming', 'no_date'] as const;
const TASK_ASSIGNMENT_FILTERS = ['all', 'me', 'unassigned'] as const;

export type TaskDueBucket = (typeof TASK_DUE_BUCKETS)[number];
export type TaskAssignmentFilter = (typeof TASK_ASSIGNMENT_FILTERS)[number];

export interface TaskListFilters {
  workspaceId?: string;
  dueBucket?: TaskDueBucket;
  assignment?: TaskAssignmentFilter;
  referenceDate?: string | null;
}

function normalizeOptionalQueryValue({ value }: TransformFnParams): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  const normalizedValue = value.trim();
  return normalizedValue === '' ? undefined : normalizedValue;
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
  @Transform(normalizeOptionalQueryValue)
  assignment?: TaskAssignmentFilter;

  @IsOptional()
  @IsTaskDueDate()
  @Transform(({ value }: TransformFnParams) => normalizeTaskDueDateInput(value))
  referenceDate?: string | null;
}
