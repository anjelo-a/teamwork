'use client';

import type { TaskSummary, WorkspaceResponse } from '@teamwork/types';
import {
  buildMonthCells,
  buildWeekDays,
  filterCalendarTasks,
  formatCalendarHeading,
  getTasksForDay,
  groupTasksByDueDate,
  type CalendarAudienceFilter,
  type CalendarView,
} from '@/lib/calendar';
import { CalendarDayView } from '@/components/calendar/calendar-day-view';
import { CalendarMonthView } from '@/components/calendar/calendar-month-view';
import { CalendarToolbar } from '@/components/calendar/calendar-toolbar';
import { CalendarWeekView } from '@/components/calendar/calendar-week-view';

interface CalendarPageProps {
  workspace: WorkspaceResponse['workspace'];
  tasks: TaskSummary[];
  currentUserId: string;
  currentView: CalendarView;
  currentFilter: CalendarAudienceFilter;
  selectedDate: string;
  onFilterChange: (value: CalendarAudienceFilter) => void;
  onViewChange: (value: CalendarView) => void;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  onTaskOpen: (taskId: string) => void;
  onShowMore: (date: string) => void;
}

export function CalendarPage({
  workspace,
  tasks,
  currentUserId,
  currentView,
  currentFilter,
  selectedDate,
  onFilterChange,
  onViewChange,
  onPrevious,
  onNext,
  onToday,
  onTaskOpen,
  onShowMore,
}: CalendarPageProps) {
  const dueDateTasks = tasks.filter((task) => task.dueDate !== null);
  const visibleTasks = filterCalendarTasks(tasks, currentUserId, currentFilter);
  const groupedTasks = groupTasksByDueDate(visibleTasks);
  const heading = formatCalendarHeading(selectedDate, currentView);
  const monthCells = buildMonthCells(selectedDate, groupedTasks);
  const weekDays = buildWeekDays(selectedDate, groupedTasks);
  const dayTasks = getTasksForDay(selectedDate, groupedTasks);
  const visibleRangeHasTasks =
    currentView === 'day'
      ? dayTasks.length > 0
      : currentView === 'week'
        ? weekDays.some((day) => day.tasks.length > 0)
        : monthCells.some((cell) => cell.tasks.length > 0);

  return (
    <section className="overflow-hidden rounded-[1.75rem] border border-line bg-surface-strong shadow-[var(--shadow)]">
      <CalendarToolbar
        currentFilter={currentFilter}
        currentView={currentView}
        onFilterChange={onFilterChange}
        onViewChange={onViewChange}
        onPrevious={onPrevious}
        onNext={onNext}
        onToday={onToday}
      />

      <div className="border-b border-line px-6 py-8 text-center">
        <p className="text-[2.05rem] font-semibold tracking-tight text-foreground">{heading}</p>
        <p className="mt-2 text-sm text-muted">
          {workspace.name} due dates shown in the {currentView} calendar view.
        </p>
      </div>

      {dueDateTasks.length === 0 ? (
        <CalendarEmptyState message="This workspace does not have any tasks with due dates yet." />
      ) : visibleTasks.length === 0 ? (
        <CalendarEmptyState message="No due-date tasks match the current calendar filter." />
      ) : !visibleRangeHasTasks ? (
        <CalendarEmptyState message="No due-date tasks fall inside the currently visible calendar range." />
      ) : null}

      {currentView === 'month' ? (
        <CalendarMonthView cells={monthCells} onTaskOpen={onTaskOpen} onShowMore={onShowMore} />
      ) : null}

      {currentView === 'week' ? (
        <CalendarWeekView days={weekDays} onTaskOpen={onTaskOpen} />
      ) : null}

      {currentView === 'day' ? <CalendarDayView tasks={dayTasks} onTaskOpen={onTaskOpen} /> : null}
    </section>
  );
}

function CalendarEmptyState({ message }: { message: string }) {
  return (
    <div className="border-b border-line bg-surface-muted/65 px-6 py-4 text-sm leading-6 text-muted">
      {message}
    </div>
  );
}
