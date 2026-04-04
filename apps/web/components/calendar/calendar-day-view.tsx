'use client';

import type { CalendarDueTask } from '@/lib/calendar';
import { CalendarTaskChip } from '@/components/calendar/calendar-task-chip';

interface CalendarDayViewProps {
  tasks: CalendarDueTask[];
  onTaskOpen: (taskId: string) => void;
}

export function CalendarDayView({ tasks, onTaskOpen }: CalendarDayViewProps) {
  return (
    <div className="px-6 pb-6">
      <div className="mx-auto flex max-w-[760px] flex-col gap-4">
        {tasks.length > 0 ? (
          tasks.map((task) => (
            <CalendarTaskChip key={task.id} task={task} variant="day" onOpen={onTaskOpen} />
          ))
        ) : (
          <div className="rounded-[1.35rem] border border-dashed border-line bg-surface-muted/70 px-6 py-10 text-center text-sm leading-6 text-muted">
            No tasks are due on this day with the current calendar filter.
          </div>
        )}
      </div>
    </div>
  );
}
