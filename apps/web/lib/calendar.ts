import type { TaskSummary, TaskStatus } from '@teamwork/types';

export type CalendarView = 'month' | 'week' | 'day';
export type CalendarAudienceFilter = 'for_me' | 'for_others' | 'for_everyone';

export interface CalendarFilterOption {
  value: CalendarAudienceFilter;
  label: string;
  description: string;
}

export interface CalendarDueTask extends TaskSummary {
  dueDate: string;
}

export interface CalendarMonthCell {
  date: string;
  dayNumber: number;
  inCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  tasks: CalendarDueTask[];
}

export interface CalendarWeekDay {
  date: string;
  weekdayShort: string;
  dayNumber: number;
  isToday: boolean;
  isSelected: boolean;
  tasks: CalendarDueTask[];
}

export const CALENDAR_FILTER_OPTIONS: CalendarFilterOption[] = [
  {
    value: 'for_me',
    label: 'For me',
    description: 'Tasks with due dates created by me or assigned to me.',
  },
  {
    value: 'for_others',
    label: 'For others',
    description: 'Tasks with due dates and assigned to others.',
  },
  {
    value: 'for_everyone',
    label: 'For everyone',
    description: 'All tasks with due dates.',
  },
];

const WEEKDAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function readCalendarView(value: string | null): CalendarView {
  return value === 'week' || value === 'day' ? value : 'month';
}

export function readCalendarAudienceFilter(value: string | null): CalendarAudienceFilter {
  return value === 'for_others' || value === 'for_everyone' ? value : 'for_me';
}

export function getTodayDateOnly(): string {
  return formatUtcDateOnly(stripTimeToUtcDate(new Date()));
}

export function readCalendarDate(value: string | null): string {
  return isValidDateOnly(value) ? value : getTodayDateOnly();
}

export function shiftCalendarDate(date: string, view: CalendarView, direction: -1 | 1): string {
  const parsedDate = parseDateOnly(date);

  if (view === 'month') {
    return formatUtcDateOnly(addUtcMonthsClamped(parsedDate, direction));
  }

  return formatUtcDateOnly(addUtcDays(parsedDate, view === 'week' ? direction * 7 : direction));
}

export function formatCalendarHeading(date: string, view: CalendarView): string {
  const parsedDate = parseDateOnly(date);

  if (view === 'month') {
    return `${readMonthLong(parsedDate.getUTCMonth())} ${String(parsedDate.getUTCFullYear())}`;
  }

  if (view === 'day') {
    return `${readWeekdayLong(parsedDate.getUTCDay())}, ${readMonthLong(parsedDate.getUTCMonth())} ${String(parsedDate.getUTCDate())}, ${String(parsedDate.getUTCFullYear())}`;
  }

  const weekStart = startOfWeek(parsedDate);
  const weekEnd = addUtcDays(weekStart, 6);
  const startMonth = readMonthShort(weekStart.getUTCMonth());
  const endMonth = readMonthShort(weekEnd.getUTCMonth());
  const startDay = String(weekStart.getUTCDate());
  const endDay = String(weekEnd.getUTCDate());
  const startYear = String(weekStart.getUTCFullYear());
  const endYear = String(weekEnd.getUTCFullYear());

  if (startYear === endYear && startMonth === endMonth) {
    return `${startMonth} ${startDay} - ${endDay}, ${startYear}`;
  }

  if (startYear === endYear) {
    return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${startYear}`;
  }

  return `${startMonth} ${startDay}, ${startYear} - ${endMonth} ${endDay}, ${endYear}`;
}

export function filterCalendarTasks(
  tasks: TaskSummary[],
  currentUserId: string,
  filter: CalendarAudienceFilter,
): CalendarDueTask[] {
  return tasks
    .filter(hasDueDate)
    .filter((task) => {
      if (filter === 'for_me') {
        return task.createdByUserId === currentUserId || task.assigneeUserId === currentUserId;
      }

      if (filter === 'for_others') {
        return task.assigneeUserId !== null && task.assigneeUserId !== currentUserId;
      }

      return true;
    });
}

export function groupTasksByDueDate(tasks: CalendarDueTask[]): Map<string, CalendarDueTask[]> {
  const groupedTasks = new Map<string, CalendarDueTask[]>();

  for (const task of tasks) {
    const existingTasks = groupedTasks.get(task.dueDate) ?? [];
    existingTasks.push(task);
    groupedTasks.set(task.dueDate, existingTasks);
  }

  return groupedTasks;
}

export function buildMonthCells(
  date: string,
  groupedTasks: Map<string, CalendarDueTask[]>,
): CalendarMonthCell[] {
  const parsedDate = parseDateOnly(date);
  const monthStart = new Date(Date.UTC(parsedDate.getUTCFullYear(), parsedDate.getUTCMonth(), 1));
  const gridStart = addUtcDays(monthStart, -monthStart.getUTCDay());
  const today = getTodayDateOnly();

  return Array.from({ length: 42 }, (_, index) => {
    const cellDate = addUtcDays(gridStart, index);
    const cellDateOnly = formatUtcDateOnly(cellDate);

    return {
      date: cellDateOnly,
      dayNumber: cellDate.getUTCDate(),
      inCurrentMonth: cellDate.getUTCMonth() === parsedDate.getUTCMonth(),
      isToday: cellDateOnly === today,
      isSelected: cellDateOnly === date,
      tasks: groupedTasks.get(cellDateOnly) ?? [],
    };
  });
}

export function buildWeekDays(
  date: string,
  groupedTasks: Map<string, CalendarDueTask[]>,
): CalendarWeekDay[] {
  const parsedDate = parseDateOnly(date);
  const today = getTodayDateOnly();
  const weekStart = startOfWeek(parsedDate);

  return Array.from({ length: 7 }, (_, index) => {
    const day = addUtcDays(weekStart, index);
    const dayDateOnly = formatUtcDateOnly(day);

    return {
      date: dayDateOnly,
      weekdayShort: readWeekdayShort(day.getUTCDay()),
      dayNumber: day.getUTCDate(),
      isToday: dayDateOnly === today,
      isSelected: dayDateOnly === date,
      tasks: groupedTasks.get(dayDateOnly) ?? [],
    };
  });
}

export function getTasksForDay(
  date: string,
  groupedTasks: Map<string, CalendarDueTask[]>,
): CalendarDueTask[] {
  return groupedTasks.get(date) ?? [];
}

export function getTaskChipStatusLabel(status: TaskStatus): string {
  if (status === 'in_progress') {
    return 'In Progress';
  }

  if (status === 'done') {
    return 'Done';
  }

  return 'To Do';
}

export function getWeekdayHeaders(): string[] {
  return [...WEEKDAY_SHORT];
}

function hasDueDate(task: TaskSummary): task is CalendarDueTask {
  return task.dueDate !== null;
}

function isValidDateOnly(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const year = Number.parseInt(value.slice(0, 4), 10);
  const month = Number.parseInt(value.slice(5, 7), 10);
  const day = Number.parseInt(value.slice(8, 10), 10);
  const parsedDate = new Date(Date.UTC(year, month - 1, day));

  return (
    parsedDate.getUTCFullYear() === year &&
    parsedDate.getUTCMonth() === month - 1 &&
    parsedDate.getUTCDate() === day
  );
}

function parseDateOnly(value: string): Date {
  const year = Number.parseInt(value.slice(0, 4), 10);
  const month = Number.parseInt(value.slice(5, 7), 10);
  const day = Number.parseInt(value.slice(8, 10), 10);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatUtcDateOnly(date: Date): string {
  const year = String(date.getUTCFullYear());
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function addUtcDays(date: Date, days: number): Date {
  const nextDate = new Date(date.getTime());
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  return nextDate;
}

function addUtcMonthsClamped(date: Date, months: number): Date {
  const nextMonthIndex = date.getUTCMonth() + months;
  const nextYear = date.getUTCFullYear() + Math.floor(nextMonthIndex / 12);
  const normalizedMonth = ((nextMonthIndex % 12) + 12) % 12;
  const lastDayOfMonth = new Date(Date.UTC(nextYear, normalizedMonth + 1, 0)).getUTCDate();
  const nextDay = Math.min(date.getUTCDate(), lastDayOfMonth);

  return new Date(Date.UTC(nextYear, normalizedMonth, nextDay));
}

function startOfWeek(date: Date): Date {
  return addUtcDays(date, -date.getUTCDay());
}

function stripTimeToUtcDate(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function readWeekdayLong(index: number): string {
  return WEEKDAY_LONG[index] ?? 'Day';
}

function readWeekdayShort(index: number): string {
  return WEEKDAY_SHORT[index] ?? 'Day';
}

function readMonthShort(index: number): string {
  return MONTH_SHORT[index] ?? 'Month';
}

function readMonthLong(index: number): string {
  return MONTH_LONG[index] ?? 'Month';
}
