import { buildMessage, type ValidationOptions, ValidateBy } from 'class-validator';

const TASK_DUE_DATE_VALIDATION_NAME = 'isTaskDueDate';
const TASK_DUE_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function normalizeTaskDueDateInput(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  const normalizedValue = value.trim();
  return normalizedValue === '' ? null : normalizedValue;
}

export function parseTaskDueDate(value: string): Date {
  const parsedDate = tryParseTaskDueDate(value);

  if (!parsedDate) {
    throw new Error('Due date must be a valid date in YYYY-MM-DD format.');
  }

  return parsedDate;
}

export function serializeTaskDueDate(value: Date | null | undefined): string | null {
  if (!value) {
    return null;
  }

  if (Number.isNaN(value.getTime())) {
    throw new Error('Due date must be a valid date.');
  }

  const year = value.getUTCFullYear().toString().padStart(4, '0');
  const month = (value.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = value.getUTCDate().toString().padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function IsTaskDueDate(validationOptions?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: TASK_DUE_DATE_VALIDATION_NAME,
      validator: {
        validate: (value: unknown): boolean =>
          typeof value === 'string' && tryParseTaskDueDate(value) !== null,
        defaultMessage: buildMessage(
          (eachPrefix) => `${eachPrefix}$property must be a valid date in YYYY-MM-DD format.`,
          validationOptions,
        ),
      },
    },
    validationOptions,
  );
}

export function tryParseTaskDueDate(value: string): Date | null {
  const match = TASK_DUE_DATE_PATTERN.exec(value);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsedDate = new Date(Date.UTC(year, month - 1, day));

  if (
    parsedDate.getUTCFullYear() !== year ||
    parsedDate.getUTCMonth() + 1 !== month ||
    parsedDate.getUTCDate() !== day
  ) {
    return null;
  }

  return parsedDate;
}
