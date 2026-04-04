'use client';

import { useMemo } from 'react';
import type { AuthenticatedWorkspace, TaskSummary } from '@teamwork/types';
import {
  ContentPanel,
  ContentPanelHeader,
  StatusBadge,
} from '@/components/app-shell/page-state';

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
    <ContentPanel>
      <ContentPanelHeader
        title="Task Inbox"
        description="Tasks across the workspaces you can access"
      />

      {sortedTasks.length === 0 ? (
        <div className="px-[var(--section-padding-x)] py-7">
          <p className="text-[1.1rem] font-semibold text-foreground">No tasks available</p>
          <p className="mt-2 text-[0.94rem] leading-6 text-muted">
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
    </ContentPanel>
  );
}

export function TaskInboxPageSkeleton() {
  return (
    <ContentPanel>
      <div className="border-b border-line px-[var(--section-padding-x)] py-[var(--section-padding-y)]">
        <div className="h-9 w-44 animate-pulse rounded-[0.95rem] bg-black/10" />
        <div className="mt-2.5 h-5 w-72 animate-pulse rounded-[0.9rem] bg-black/5" />
      </div>

      <div className="divide-y divide-line">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={String(index)} className="px-[var(--section-padding-x)] py-[1.125rem]">
            <div className="h-4 w-28 animate-pulse rounded-full bg-black/6" />
            <div className="mt-3.5 h-6 w-60 animate-pulse rounded-full bg-black/10" />
            <div className="mt-2.5 h-4 w-full animate-pulse rounded-full bg-black/5" />
            <div className="mt-2 h-4 w-2/3 animate-pulse rounded-full bg-black/5" />
            <div className="mt-3.5 flex gap-3">
              <div className="h-7 w-[5.5rem] animate-pulse rounded-full bg-black/6" />
              <div className="h-7 w-[6.5rem] animate-pulse rounded-full bg-black/6" />
              <div className="h-7 w-[4.5rem] animate-pulse rounded-full bg-black/6" />
            </div>
          </div>
        ))}
      </div>
    </ContentPanel>
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
      className="flex w-full flex-col gap-3.5 px-[var(--section-padding-x)] py-[1.125rem] text-left transition-colors hover:bg-surface-muted/45"
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex min-h-7 items-center rounded-full bg-surface-muted px-3 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-muted">
          {workspaceName}
        </span>
        <StatusBadge label={readStatusLabel(task.status)} tone={getStatusTone(task.status)} />
        <span className="text-[0.88rem] text-muted">
          {task.dueDate ? `Due ${formatDate(task.dueDate)}` : 'No due date'}
        </span>
      </div>

      <div>
        <h3 className="text-[1.12rem] font-semibold tracking-tight text-foreground">{task.title}</h3>
        {task.description ? (
          <p className="mt-1.5 line-clamp-2 text-[0.92rem] leading-6 text-muted">
            {task.description}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[0.88rem] text-muted">
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

function getStatusTone(status: TaskSummary['status']): 'accent' | 'progress' | 'default' {
  if (status === 'done') {
    return 'accent';
  }

  if (status === 'in_progress') {
    return 'progress';
  }

  return 'default';
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
