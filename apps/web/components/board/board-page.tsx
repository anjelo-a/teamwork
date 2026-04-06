'use client';

import { memo, useMemo } from 'react';
import type { TaskSummary, WorkspaceResponse } from '@teamwork/types';
import { BoardColumn } from '@/components/board/board-column';
import { BoardFiltersPanel } from '@/components/board/board-filters';
import { BoardWorkspaceSummary } from '@/components/board/board-workspace-summary';
import {
  filterBoardTasks,
  groupBoardTasks,
  type BoardAssigneeFilter,
  type BoardStatusFilter,
} from '@/lib/board';

interface BoardPageProps {
  workspace: WorkspaceResponse['workspace'];
  tasks: TaskSummary[];
  assigneeFilter: BoardAssigneeFilter;
  assigneeOptions: BoardAssigneeFilter[];
  statusFilter: BoardStatusFilter;
  statusOptions: BoardStatusFilter[];
  currentUserId: string;
  membersUnavailable: boolean;
  onStatusChange: (value: BoardStatusFilter) => void;
  onAssigneeChange: (value: BoardAssigneeFilter) => void;
  onTaskOpen: (taskId: string) => void;
}

export const BoardPage = memo(function BoardPage({
  workspace,
  tasks,
  assigneeFilter,
  assigneeOptions,
  statusFilter,
  statusOptions,
  currentUserId,
  membersUnavailable,
  onStatusChange,
  onAssigneeChange,
  onTaskOpen,
}: BoardPageProps) {
  const visibleTasks = useMemo(
    () =>
      filterBoardTasks(tasks, {
        assigneeFilter,
        statusFilter,
        currentUserId,
      }),
    [assigneeFilter, currentUserId, statusFilter, tasks],
  );

  const groupedColumns = useMemo(() => groupBoardTasks(visibleTasks), [visibleTasks]);
  const hasAnyVisibleTasks = visibleTasks.length > 0;

  return (
    <div className="overflow-hidden rounded-[1.3rem] border border-line bg-surface-strong shadow-[var(--panel-shadow)]">
      <BoardWorkspaceSummary workspace={workspace} />
      <div className="flex min-w-0 flex-col xl:flex-row xl:items-start">
        <BoardFiltersPanel
          statusFilter={statusFilter}
          assigneeFilter={assigneeFilter}
          statusOptions={statusOptions}
          assigneeOptions={assigneeOptions}
          onStatusChange={onStatusChange}
          onAssigneeChange={onAssigneeChange}
          membersUnavailable={membersUnavailable}
        />

        <div className="min-w-0 flex-1">
          <div className="grid min-w-0 grid-cols-1 divide-y divide-line md:grid-cols-2 md:divide-x md:divide-y-0 xl:grid-cols-3">
            {groupedColumns.map((column) => (
              <BoardColumn
                key={column.status}
                column={column}
                hasAnyVisibleTasks={hasAnyVisibleTasks}
                onTaskOpen={onTaskOpen}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});
