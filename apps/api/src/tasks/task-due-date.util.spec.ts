import {
  normalizeTaskDueDateInput,
  parseTaskDueDate,
  serializeTaskDueDate,
  tryParseTaskDueDate,
} from './task-due-date.util';

describe('task due date utilities', () => {
  it('parses and serializes YYYY-MM-DD values without timezone drift', () => {
    const dueDate = parseTaskDueDate('2026-04-02');

    expect(dueDate.toISOString()).toBe('2026-04-02T00:00:00.000Z');
    expect(serializeTaskDueDate(dueDate)).toBe('2026-04-02');
  });

  it('rejects impossible calendar dates', () => {
    expect(() => parseTaskDueDate('2026-02-29')).toThrow(
      'Due date must be a valid date in YYYY-MM-DD format.',
    );
    expect(tryParseTaskDueDate('2026-02-29')).toBeNull();
  });

  it('trims due date inputs and maps blank strings to null', () => {
    expect(normalizeTaskDueDateInput(' 2026-04-02 ')).toBe('2026-04-02');
    expect(normalizeTaskDueDateInput('   ')).toBeNull();
  });

  it('serializes null due dates as null', () => {
    expect(serializeTaskDueDate(null)).toBeNull();
  });
});
