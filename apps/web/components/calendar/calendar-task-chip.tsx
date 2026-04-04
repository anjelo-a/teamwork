'use client';

import type { CalendarDueTask } from '@/lib/calendar';
import { getTaskChipStatusLabel } from '@/lib/calendar';

interface CalendarTaskChipProps {
  task: CalendarDueTask;
  variant: 'month' | 'week' | 'day';
  onOpen: (taskId: string) => void;
}

export function CalendarTaskChip({ task, variant, onOpen }: CalendarTaskChipProps) {
  if (variant === 'day') {
    return (
      <button
        type="button"
        onClick={() => {
          onOpen(task.id);
        }}
        className="flex w-full items-center justify-between gap-4 rounded-[1.1rem] border border-line bg-surface-strong px-4 py-4 text-left shadow-[0_10px_28px_rgba(15,23,20,0.06)] transition-colors hover:border-line-strong"
      >
        <div className="min-w-0">
          <p className="truncate text-base font-semibold tracking-tight text-foreground">{task.title}</p>
          <p className="mt-2 truncate text-sm text-muted">
            {task.assigneeUser?.displayName ?? task.createdByUser.displayName}
          </p>
        </div>
        <span className={getStatusBadgeClassName(task.status)}>{getTaskChipStatusLabel(task.status)}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        onOpen(task.id);
      }}
      className={`w-full rounded-[0.8rem] border border-line/80 bg-surface-muted px-3 py-2 text-left text-sm font-medium text-foreground transition-colors hover:border-line-strong ${
        variant === 'month' ? 'truncate' : ''
      }`}
      title={task.title}
    >
      <span className="block truncate">{task.title}</span>
    </button>
  );
}

function getStatusBadgeClassName(status: CalendarDueTask['status']): string {
  if (status === 'done') {
    return 'inline-flex min-h-8 items-center rounded-full bg-accent-soft px-3 text-xs font-semibold text-accent';
  }

  if (status === 'in_progress') {
    return 'inline-flex min-h-8 items-center rounded-full bg-[#e8eef8] px-3 text-xs font-semibold text-[#365489]';
  }

  return 'inline-flex min-h-8 items-center rounded-full bg-surface-muted px-3 text-xs font-semibold text-muted';
}
