'use client';

import { useMemo } from 'react';
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

export function BoardPage({
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
    <div className="flex min-w-0 flex-col gap-5">
      <BoardWorkspaceSummary workspace={workspace} />
      <div className="flex min-w-0 gap-5">
        <BoardFiltersPanel
          statusFilter={statusFilter}
          assigneeFilter={assigneeFilter}
          statusOptions={statusOptions}
          assigneeOptions={assigneeOptions}
          onStatusChange={onStatusChange}
          onAssigneeChange={onAssigneeChange}
          membersUnavailable={membersUnavailable}
        />

        <div className="min-w-0 flex-1 overflow-x-auto pb-2">
          <div className="flex min-w-[930px] gap-5">
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
}
