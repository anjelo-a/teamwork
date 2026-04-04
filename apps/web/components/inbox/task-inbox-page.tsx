'use client';

import { useMemo } from 'react';
import type { AuthenticatedWorkspace, TaskSummary } from '@teamwork/types';

interface TaskInboxPageProps {
  tasks: TaskSummary[];
  workspaces: AuthenticatedWorkspace[];
  onTaskOpen: (task: TaskSummary) => void;
}

export function TaskInboxPage({
  tasks,
  workspaces,
  onTaskOpen,
}: TaskInboxPageProps) {
  const sortedTasks = useMemo(
    () =>
      [...tasks].sort((left, right) => {
        if (left.dueDate && right.dueDate && left.dueDate !== right.dueDate) {
          return left.dueDate.localeCompare(right.dueDate);
        }

        if (left.dueDate && !right.dueDate) {
          return -1;
        }

        if (!left.dueDate && right.dueDate) {
          return 1;
        }

        return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
      }),
    [tasks],
  );
  const workspaceNames = useMemo(
    () =>
      new Map(workspaces.map((workspace) => [workspace.id, workspace.name] as const)),
    [workspaces],
  );

  return (
    <section className="rounded-[1.5rem] border border-line bg-surface-strong shadow-[0_18px_38px_rgba(15,23,20,0.06)]">
      <div className="border-b border-line px-8 py-7">
        <h2 className="text-[2rem] font-semibold tracking-tight text-foreground">Task Inbox</h2>
        <p className="mt-2 text-[1.08rem] leading-7 text-[#8a98af]">
          Tasks across the workspaces you can access
        </p>
      </div>

      {sortedTasks.length === 0 ? (
        <div className="px-8 py-8">
          <p className="text-lg font-semibold text-foreground">No tasks available</p>
          <p className="mt-2 text-sm leading-6 text-muted">
            Tasks assigned to your accessible workspaces will appear here.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-line">
          {sortedTasks.map((task) => (
            <TaskInboxRow
              key={task.id}
              task={task}
              workspaceName={workspaceNames.get(task.workspaceId) ?? 'Workspace'}
              onOpen={onTaskOpen}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export function TaskInboxPageSkeleton() {
  return (
    <section className="rounded-[1.5rem] border border-line bg-surface-strong shadow-[0_18px_38px_rgba(15,23,20,0.06)]">
      <div className="border-b border-line px-8 py-7">
        <div className="h-10 w-48 animate-pulse rounded-2xl bg-black/10" />
        <div className="mt-3 h-6 w-80 animate-pulse rounded-2xl bg-black/5" />
      </div>

      <div className="divide-y divide-line">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={String(index)} className="px-8 py-5">
            <div className="h-4 w-28 animate-pulse rounded-full bg-black/6" />
            <div className="mt-4 h-6 w-60 animate-pulse rounded-full bg-black/10" />
            <div className="mt-3 h-4 w-full animate-pulse rounded-full bg-black/5" />
            <div className="mt-2 h-4 w-2/3 animate-pulse rounded-full bg-black/5" />
            <div className="mt-4 flex gap-3">
              <div className="h-8 w-24 animate-pulse rounded-full bg-black/6" />
              <div className="h-8 w-28 animate-pulse rounded-full bg-black/6" />
              <div className="h-8 w-20 animate-pulse rounded-full bg-black/6" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function TaskInboxRow({
  task,
  workspaceName,
  onOpen,
}: {
  task: TaskSummary;
  workspaceName: string;
  onOpen: (task: TaskSummary) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        onOpen(task);
      }}
      className="flex w-full flex-col gap-4 px-8 py-5 text-left transition-colors hover:bg-surface-muted/50"
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex min-h-8 items-center rounded-full bg-surface-muted px-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted">
          {workspaceName}
        </span>
        <span className={getStatusClassName(task.status)}>{readStatusLabel(task.status)}</span>
        <span className="text-sm text-muted">{task.dueDate ? `Due ${formatDate(task.dueDate)}` : 'No due date'}</span>
      </div>

      <div>
        <h3 className="text-[1.2rem] font-semibold tracking-tight text-foreground">{task.title}</h3>
        {task.description ? (
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#7a8aa2]">{task.description}</p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-[#8d9ab0]">
        <TaskMeta label={task.assigneeUser?.displayName ?? 'Unassigned'} />
        <TaskMeta label={`By ${task.createdByUser.displayName}`} />
        <TaskMeta label={`Updated ${formatDateTime(task.updatedAt)}`} />
      </div>
    </button>
  );
}

function TaskMeta({ label }: { label: string }) {
  return <span className="font-medium">{label}</span>;
}

function readStatusLabel(status: TaskSummary['status']): string {
  if (status === 'in_progress') {
    return 'In Progress';
  }

  if (status === 'done') {
    return 'Done';
  }

  return 'To Do';
}

function getStatusClassName(status: TaskSummary['status']): string {
  if (status === 'done') {
    return 'inline-flex min-h-8 items-center rounded-full bg-accent-soft px-3 text-xs font-semibold text-accent';
  }

  if (status === 'in_progress') {
    return 'inline-flex min-h-8 items-center rounded-full bg-[#e8eef8] px-3 text-xs font-semibold text-[#365489]';
  }

  return 'inline-flex min-h-8 items-center rounded-full bg-surface-muted px-3 text-xs font-semibold text-muted';
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}
