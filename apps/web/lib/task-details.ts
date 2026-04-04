import type { TaskDetails, UpdateTaskInput, WorkspaceMemberDetail } from '@teamwork/types';
import {
  TASK_DESCRIPTION_MAX_LENGTH,
  TASK_TITLE_MAX_LENGTH,
  normalizeTaskDescription,
  normalizeTaskTitle,
} from '@teamwork/validation';

export interface TaskEditorValues {
  title: string;
  description: string;
  dueDate: string;
}

export type TaskDetailErrorState = Partial<
  Record<'title' | 'description' | 'dueDate' | 'form', string>
>;

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function createTaskEditorValues(task: TaskDetails): TaskEditorValues {
  return {
    title: task.title,
    description: task.description ?? '',
    dueDate: task.dueDate ?? '',
  };
}

export function validateTaskEditorValues(
  values: TaskEditorValues,
): {
  input: UpdateTaskInput | null;
  errors: TaskDetailErrorState;
} {
  const title = normalizeTaskTitle(values.title);
  const description = normalizeTaskDescription(values.description);
  const dueDate = values.dueDate.trim();
  const errors: TaskDetailErrorState = {};

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
      dueDate: dueDate || null,
    },
    errors: {},
  };
}

export function isValidAssignee(
  assigneeUserId: string | null,
  members: WorkspaceMemberDetail[] | null,
): boolean {
  if (!assigneeUserId || !members) {
    return true;
  }

  return members.some((member) => member.userId === assigneeUserId);
}

export function formatTaskTimestamp(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

function isValidDateOnly(value: string): boolean {
  if (!DATE_ONLY_PATTERN.test(value)) {
    return false;
  }

  const [yearText, monthText, dayText] = value.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const resolvedDate = new Date(Date.UTC(year, month - 1, day));

  return (
    Number.isInteger(year) &&
    Number.isInteger(month) &&
    Number.isInteger(day) &&
    resolvedDate.getUTCFullYear() === year &&
    resolvedDate.getUTCMonth() === month - 1 &&
    resolvedDate.getUTCDate() === day
  );
}
