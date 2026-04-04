import type { CreateTaskInput, WorkspaceMemberDetail } from '@teamwork/types';
import {
  TASK_DESCRIPTION_MAX_LENGTH,
  TASK_TITLE_MAX_LENGTH,
  normalizeTaskDescription,
  normalizeTaskTitle,
} from '@teamwork/validation';

export interface CreateTaskFormValues {
  title: string;
  description: string;
  assigneeUserId: string;
  dueDate: string;
}

export interface CreateTaskValidationResult {
  input: CreateTaskInput | null;
  errors: Partial<Record<'title' | 'description' | 'assigneeUserId' | 'dueDate' | 'form', string>>;
}

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function validateCreateTaskInput(
  values: CreateTaskFormValues,
  members: WorkspaceMemberDetail[] | null,
): CreateTaskValidationResult {
  const title = normalizeTaskTitle(values.title);
  const description = normalizeTaskDescription(values.description);
  const dueDate = values.dueDate.trim();
  const assigneeUserId = values.assigneeUserId.trim();
  const errors: CreateTaskValidationResult['errors'] = {};

  if (!title) {
    errors.title = 'Task title is required.';
  } else if (title.length > TASK_TITLE_MAX_LENGTH) {
    errors.title = `Task title must be ${String(TASK_TITLE_MAX_LENGTH)} characters or fewer.`;
  }

  if (description.length > TASK_DESCRIPTION_MAX_LENGTH) {
    errors.description = `Description must be ${String(TASK_DESCRIPTION_MAX_LENGTH)} characters or fewer.`;
  }

  if (dueDate && !isValidDateOnly(dueDate)) {
    errors.dueDate = 'Due date must be a valid YYYY-MM-DD date.';
  }

  if (assigneeUserId && members && !members.some((member) => member.userId === assigneeUserId)) {
    errors.assigneeUserId = 'Assignee must be a current workspace member.';
  }

  if (Object.keys(errors).length > 0) {
    return {
      input: null,
      errors,
    };
  }

  return {
    input: {
      title,
      description: description ? description : null,
      assigneeUserId: assigneeUserId ? assigneeUserId : null,
      dueDate: dueDate || null,
    },
    errors: {},
  };
}

function isValidDateOnly(value: string): boolean {
  if (!DATE_ONLY_PATTERN.test(value)) {
    return false;
  }

  const [yearText, monthText, dayText] = value.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return false;
  }

  const resolvedDate = new Date(Date.UTC(year, month - 1, day));

  return (
    resolvedDate.getUTCFullYear() === year &&
    resolvedDate.getUTCMonth() === month - 1 &&
    resolvedDate.getUTCDate() === day
  );
}
