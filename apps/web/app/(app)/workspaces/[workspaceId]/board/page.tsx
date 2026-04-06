'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import type { TaskSummary } from '@teamwork/types';
import { CreateTaskModal } from '@/components/board/create-task-modal';
import { BoardLoadingState } from '@/components/board/board-loading';
import { BoardPage } from '@/components/board/board-page';
import { TaskDetailsModal } from '@/components/board/task-details-modal';
import { PageStatusCard, PageSurface } from '@/components/app-shell/page-state';
import { useAuthSession } from '@/lib/auth/auth-session-provider';
import {
  getWorkspaceDetails,
  getWorkspaceMembers,
  listWorkspaceTasks,
} from '@/lib/api/client';
import {
  DEFAULT_BOARD_ASSIGNEE_FILTER,
  DEFAULT_BOARD_STATUS_FILTER,
  buildBoardAssigneeOptions,
  getBackendAssignmentFilter,
  matchesTaskAssignmentFilter,
  resolveBoardAssigneeFilter,
  type BoardStatusFilter,
} from '@/lib/board';
import { useAuthenticatedApiResource } from '@/lib/hooks/use-authenticated-api-resource';
import { useAppShellAction } from '@/lib/app-shell-action-context';
import { readWorkspaceIdFromParams } from '@/lib/route-params';
import { removeTaskSummary, upsertTaskSummary } from '@/lib/task-list';

const STATUS_OPTIONS: BoardStatusFilter[] = ['all', 'todo', 'in_progress', 'done'];

export default function WorkspaceBoardPage() {
  const params = useParams();
  const workspaceId = readWorkspaceIdFromParams(params);
  const { auth } = useAuthSession();
  const [statusFilter, setStatusFilter] = useState(DEFAULT_BOARD_STATUS_FILTER);
  const [assigneeFilter, setAssigneeFilter] = useState(DEFAULT_BOARD_ASSIGNEE_FILTER);
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [taskItemsState, setTaskItemsState] = useState<{
    key: string | null;
    tasks: TaskSummary[];
  }>({
    key: null,
    tasks: [],
  });
  const { setActionOverride } = useAppShellAction();

  const workspaceQuery = useAuthenticatedApiResource({
    key: `workspace:${workspaceId}:board`,
    load: (accessToken) => getWorkspaceDetails(workspaceId, accessToken),
  });
  const membersQuery = useAuthenticatedApiResource({
    key: `workspace:${workspaceId}:members:board`,
    load: (accessToken) => getWorkspaceMembers(workspaceId, accessToken),
  });

  const assigneeOptions = useMemo(
    () =>
      buildBoardAssigneeOptions(
        membersQuery.status === 'success' ? membersQuery.data.members : null,
        auth.user,
      ),
    [auth.user, membersQuery],
  );
  const resolvedAssigneeFilter = useMemo(
    () => resolveBoardAssigneeFilter(assigneeOptions, assigneeFilter),
    [assigneeFilter, assigneeOptions],
  );
  const backendAssignmentFilter = getBackendAssignmentFilter(resolvedAssigneeFilter);
  const taskQueryKey = `workspace:${workspaceId}:tasks:board:${backendAssignmentFilter ?? 'everyone'}`;

  const tasksQuery = useAuthenticatedApiResource({
    key: taskQueryKey,
    load: (accessToken) =>
      listWorkspaceTasks(
        workspaceId,
        accessToken,
        backendAssignmentFilter ? { assignment: backendAssignmentFilter } : undefined,
      ),
  });
  const taskItems =
    taskItemsState.key === taskQueryKey
      ? taskItemsState.tasks
      : tasksQuery.status === 'success'
        ? tasksQuery.data.tasks
        : [];

  const openCreateTaskModal = useCallback(() => {
    setIsCreateTaskOpen(true);
  }, []);

  const closeCreateTaskModal = useCallback(() => {
    setIsCreateTaskOpen(false);
  }, []);

  const openTaskDetailsModal = useCallback((taskId: string) => {
    setSelectedTaskId(taskId);
  }, []);

  const closeTaskDetailsModal = useCallback(() => {
    setSelectedTaskId(null);
  }, []);

  useEffect(() => {
    if (workspaceQuery.status !== 'success') {
      setActionOverride(null);
      return;
    }

    setActionOverride({
      label: 'Create Task',
      onAction: openCreateTaskModal,
    });

    return () => {
      setActionOverride(null);
    };
  }, [openCreateTaskModal, setActionOverride, workspaceQuery.status]);

  return (
    <div className="mx-auto flex w-full max-w-[1520px] flex-col">
      {workspaceQuery.status === 'loading' || tasksQuery.status === 'loading' ? (
        <BoardLoadingState />
      ) : null}

      {workspaceQuery.status === 'error' ? (
        <PageStatusCard
          title="Workspace unavailable"
          description={
            workspaceQuery.error.message
              ? `This workspace could not be loaded right now. ${workspaceQuery.error.message}`
              : 'This workspace could not be loaded right now.'
          }
          tone="danger"
          actionLabel="Retry board"
          onAction={() => {
            window.location.reload();
          }}
        />
      ) : null}

      {tasksQuery.status === 'error' ? (
        <PageStatusCard
          title="Board unavailable"
          description={
            tasksQuery.error.message
              ? `Workspace tasks could not be loaded right now. ${tasksQuery.error.message}`
              : 'Workspace tasks could not be loaded right now.'
          }
          tone="danger"
          actionLabel="Retry board"
          onAction={() => {
            window.location.reload();
          }}
        />
      ) : null}

      {workspaceQuery.status === 'success' && tasksQuery.status === 'success' ? (
        <div className="flex flex-col gap-3">
          {membersQuery.status === 'error' ? (
            <PageSurface
              eyebrow="Limited filters"
              title="Members unavailable"
              description="Tasks are available, but member-specific filters are unavailable until workspace members can be loaded."
            />
          ) : null}

          <BoardPage
            workspace={workspaceQuery.data.workspace}
            tasks={taskItems}
            assigneeFilter={resolvedAssigneeFilter}
            assigneeOptions={assigneeOptions}
            statusFilter={statusFilter}
            statusOptions={STATUS_OPTIONS}
            currentUserId={auth.user.id}
            membersUnavailable={membersQuery.status === 'error'}
            onStatusChange={setStatusFilter}
            onAssigneeChange={setAssigneeFilter}
            onTaskOpen={openTaskDetailsModal}
          />
        </div>
      ) : null}

      <CreateTaskModal
        open={isCreateTaskOpen}
        workspaceId={workspaceId}
        members={membersQuery.status === 'success' ? membersQuery.data.members : null}
        membersUnavailable={membersQuery.status === 'error'}
        onClose={closeCreateTaskModal}
        onCreated={(task) => {
          setTaskItemsState((current) => ({
            key: taskQueryKey,
            tasks: upsertTaskSummary(
              current.key === taskQueryKey ? current.tasks : taskItems,
              task,
              {
              shouldInclude: matchesTaskAssignmentFilter(
                task,
                backendAssignmentFilter,
                auth.user.id,
              ),
              },
            ),
          }));
        }}
      />

      <TaskDetailsModal
        open={selectedTaskId !== null}
        taskId={selectedTaskId}
        workspaceId={workspaceId}
        members={membersQuery.status === 'success' ? membersQuery.data.members : null}
        membersUnavailable={membersQuery.status === 'error'}
        onClose={closeTaskDetailsModal}
        onTaskChanged={(task) => {
          setTaskItemsState((current) => ({
            key: taskQueryKey,
            tasks: upsertTaskSummary(
              current.key === taskQueryKey ? current.tasks : taskItems,
              task,
              {
              shouldInclude: matchesTaskAssignmentFilter(
                task,
                backendAssignmentFilter,
                auth.user.id,
              ),
              },
            ),
          }));
        }}
        onTaskDeleted={(taskId) => {
          setSelectedTaskId(null);
          setTaskItemsState((current) => ({
            key: taskQueryKey,
            tasks: removeTaskSummary(current.key === taskQueryKey ? current.tasks : taskItems, taskId),
          }));
        }}
      />
    </div>
  );
}
