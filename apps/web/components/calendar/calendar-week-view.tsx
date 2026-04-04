'use client';

import type { CalendarWeekDay } from '@/lib/calendar';
import { CalendarTaskChip } from '@/components/calendar/calendar-task-chip';

interface CalendarWeekViewProps {
  days: CalendarWeekDay[];
  onTaskOpen: (taskId: string) => void;
}

export function CalendarWeekView({ days, onTaskOpen }: CalendarWeekViewProps) {
  return (
    <div className="grid grid-cols-7 gap-4 px-6 pb-6">
      {days.map((day) => (
        <div key={day.date} className="flex min-h-[340px] flex-col rounded-[1.35rem] border border-line bg-surface-strong p-4">
          <div className="flex flex-col items-center gap-3 border-b border-line pb-4">
            <span className="text-sm font-semibold text-muted">{day.weekdayShort}</span>
            <span
              className={`inline-flex h-12 min-w-12 items-center justify-center rounded-full px-3 text-lg font-semibold ${
                day.isSelected
                  ? 'bg-[#65d8c8] text-white'
                  : day.isToday
                    ? 'border border-accent/25 text-accent'
                    : 'text-foreground'
              }`}
            >
              {day.dayNumber}
            </span>
          </div>

          <div className="mt-4 flex flex-1 flex-col gap-3">
            {day.tasks.length > 0 ? (
              day.tasks.map((task) => (
                <CalendarTaskChip key={task.id} task={task} variant="week" onOpen={onTaskOpen} />
              ))
            ) : (
              <div className="rounded-[1rem] border border-dashed border-line px-3 py-4 text-center text-sm text-muted">
                No tasks due
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
