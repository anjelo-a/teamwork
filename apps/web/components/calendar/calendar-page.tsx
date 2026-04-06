'use client';

import { memo, useMemo } from 'react';
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
import { ContentPanel } from '@/components/app-shell/page-state';

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

export const CalendarPage = memo(function CalendarPage({
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
  const dueDateTasks = useMemo(() => tasks.filter((task) => task.dueDate !== null), [tasks]);
  const visibleTasks = useMemo(
    () => filterCalendarTasks(tasks, currentUserId, currentFilter),
    [currentFilter, currentUserId, tasks],
  );
  const groupedTasks = useMemo(() => groupTasksByDueDate(visibleTasks), [visibleTasks]);
  const heading = useMemo(
    () => formatCalendarHeading(selectedDate, currentView),
    [currentView, selectedDate],
  );
  const monthCells = useMemo(
    () => buildMonthCells(selectedDate, groupedTasks),
    [groupedTasks, selectedDate],
  );
  const weekDays = useMemo(
    () => buildWeekDays(selectedDate, groupedTasks),
    [groupedTasks, selectedDate],
  );
  const dayTasks = useMemo(
    () => getTasksForDay(selectedDate, groupedTasks),
    [groupedTasks, selectedDate],
  );
  const visibleRangeHasTasks =
    currentView === 'day'
      ? dayTasks.length > 0
      : currentView === 'week'
        ? weekDays.some((day) => day.tasks.length > 0)
        : monthCells.some((cell) => cell.tasks.length > 0);

  return (
    <ContentPanel className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <CalendarToolbar
        currentFilter={currentFilter}
        currentView={currentView}
        onFilterChange={onFilterChange}
        onViewChange={onViewChange}
        onPrevious={onPrevious}
        onNext={onNext}
        onToday={onToday}
      />

      <div className="border-b border-line px-5 py-5 text-center">
        <p className="text-[1.6rem] font-semibold tracking-tight text-foreground">{heading}</p>
        <p className="mt-1 text-[0.875rem] text-muted">
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
        <div className="flex min-h-0 flex-1">
          <CalendarMonthView cells={monthCells} onTaskOpen={onTaskOpen} onShowMore={onShowMore} />
        </div>
      ) : null}

      {currentView === 'week' ? (
        <div className="flex min-h-0 flex-1">
          <CalendarWeekView days={weekDays} onTaskOpen={onTaskOpen} />
        </div>
      ) : null}

      {currentView === 'day' ? (
        <div className="flex min-h-0 flex-1">
          <CalendarDayView tasks={dayTasks} onTaskOpen={onTaskOpen} />
        </div>
      ) : null}
    </ContentPanel>
  );
});

function CalendarEmptyState({ message }: { message: string }) {
  return (
    <div className="border-b border-line bg-surface-muted px-5 py-3 text-[0.875rem] leading-6 text-muted">
      {message}
    </div>
  );
}
