'use client';

import type { CalendarMonthCell } from '@/lib/calendar';
import { getWeekdayHeaders } from '@/lib/calendar';
import { CalendarTaskChip } from '@/components/calendar/calendar-task-chip';

interface CalendarMonthViewProps {
  cells: CalendarMonthCell[];
  onTaskOpen: (taskId: string) => void;
  onShowMore: (date: string) => void;
}

const MAX_VISIBLE_TASKS = 2;

export function CalendarMonthView({
  cells,
  onTaskOpen,
  onShowMore,
}: CalendarMonthViewProps) {
  const weekdayHeaders = getWeekdayHeaders();

  return (
    <div className="overflow-hidden rounded-b-[1.75rem]">
      <div className="grid grid-cols-7 border-b border-line bg-surface-muted/80">
        {weekdayHeaders.map((header) => (
          <div
            key={header}
            className="border-r border-line px-4 py-3 text-center text-sm font-semibold text-muted last:border-r-0"
          >
            {header}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((cell) => {
          const visibleTasks = cell.tasks.slice(0, MAX_VISIBLE_TASKS);
          const remainingCount = cell.tasks.length - visibleTasks.length;

          return (
            <div
              key={cell.date}
              className={`min-h-[145px] border-r border-b border-line px-3 py-3 align-top last:border-r-0 ${
                cell.inCurrentMonth ? 'bg-surface-strong' : 'bg-surface-muted/80'
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`inline-flex h-8 min-w-8 items-center justify-center rounded-full px-2 text-sm font-semibold ${
                    cell.isSelected
                      ? 'bg-[#65d8c8] text-white'
                      : cell.isToday
                        ? 'border border-accent/25 text-accent'
                        : cell.inCurrentMonth
                          ? 'text-foreground'
                          : 'text-muted'
                  }`}
                >
                  {cell.dayNumber}
                </span>
              </div>

              <div className="mt-3 flex flex-col gap-2">
                {visibleTasks.map((task) => (
                  <CalendarTaskChip key={task.id} task={task} variant="month" onOpen={onTaskOpen} />
                ))}

                {remainingCount > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      onShowMore(cell.date);
                    }}
                    className="text-left text-xs font-semibold text-accent transition-colors hover:text-accent-strong"
                  >
                    +{remainingCount} more
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
