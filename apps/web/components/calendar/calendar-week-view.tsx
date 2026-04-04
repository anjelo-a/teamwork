'use client';

import type { CalendarWeekDay } from '@/lib/calendar';
import { CalendarTaskChip } from '@/components/calendar/calendar-task-chip';

interface CalendarWeekViewProps {
  days: CalendarWeekDay[];
  onTaskOpen: (taskId: string) => void;
}

export function CalendarWeekView({ days, onTaskOpen }: CalendarWeekViewProps) {
  return (
    <div className="grid grid-cols-7 gap-3 px-6 pb-6">
      {days.map((day) => (
        <div key={day.date} className="flex min-h-[320px] flex-col rounded-[1rem] border border-line bg-surface-strong p-3.5">
          <div className="flex flex-col items-center gap-2.5 border-b border-line pb-3.5">
            <span className="text-[0.82rem] font-semibold text-muted">{day.weekdayShort}</span>
            <span
              className={`inline-flex h-10 min-w-10 items-center justify-center rounded-full px-3 text-[1rem] font-semibold ${
                day.isSelected
                  ? 'bg-accent text-white'
                  : day.isToday
                    ? 'border border-accent/25 text-accent'
                    : 'text-foreground'
              }`}
            >
              {day.dayNumber}
            </span>
          </div>

          <div className="mt-3.5 flex flex-1 flex-col gap-2.5">
            {day.tasks.length > 0 ? (
              day.tasks.map((task) => (
                <CalendarTaskChip key={task.id} task={task} variant="week" onOpen={onTaskOpen} />
              ))
            ) : (
              <div className="rounded-[0.85rem] border border-dashed border-line px-3 py-4 text-center text-[0.85rem] text-muted">
                No tasks due
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
