'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import type { WorkspaceBoardDataResponse } from '@teamwork/types';
import { BoardLoadingState } from '@/components/board/board-loading';
import { BoardPage } from '@/components/board/board-page';
import { PageStatusCard, PageSurface } from '@/components/app-shell/page-state';
import { useAuthSession } from '@/lib/auth/auth-session-provider';
import { getWorkspaceBoardData, getWorkspaceMembers } from '@/lib/api/client';
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
import {
  applyTaskOverlayMutation,
  applyTaskOverlayRemoval,
  mergeTaskListOverlay,
  type TaskListOverlay,
} from '@/lib/task-list';

const CreateTaskModal = dynamic(
  () => import('@/components/board/create-task-modal').then((module) => module.CreateTaskModal),
  {
    ssr: false,
  },
);
const TaskDetailsModal = dynamic(
  () => import('@/components/board/task-details-modal').then((module) => module.TaskDetailsModal),
  {
    ssr: false,
  },
);

const STATUS_OPTIONS: BoardStatusFilter[] = ['all', 'todo', 'in_progress', 'done'];
const GENERIC_BOARD_ERROR_MESSAGE = 'This workspace board could not be loaded right now.';
const BOARD_CACHE_TTL_MS = 30_000;

interface WorkspaceBoardPageClientProps {
  workspaceId: string;
  initialBoardData: WorkspaceBoardDataResponse | null;
}

export function WorkspaceBoardPageClient({
  workspaceId,
  initialBoardData,
}: WorkspaceBoardPageClientProps) {
  const { auth } = useAuthSession();
  const [statusFilter, setStatusFilter] = useState(DEFAULT_BOARD_STATUS_FILTER);
  const [assigneeFilter, setAssigneeFilter] = useState(DEFAULT_BOARD_ASSIGNEE_FILTER);
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [boardRetryNonce, setBoardRetryNonce] = useState(0);
  const [taskItemsState, setTaskItemsState] = useState<{
    key: string | null;
    overlay: TaskListOverlay;
  }>({
    key: null,
    overlay: {
      tasks: [],
      removedTaskIds: [],
    },
  });
  const { setActionOverride } = useAppShellAction();

  const backendAssignmentFilter = getBackendAssignmentFilter(assigneeFilter);
  const boardQueryKey = `workspace:${workspaceId}:board-data:${backendAssignmentFilter ?? 'everyone'}:retry:${String(boardRetryNonce)}`;

  const boardDataQuery = useAuthenticatedApiResource({
    key: boardQueryKey,
    load: (accessToken) =>
      getWorkspaceBoardData(
        workspaceId,
        accessToken,
        backendAssignmentFilter
          ? { assignment: backendAssignmentFilter, includeMembers: false }
          : { includeMembers: false },
      ),
    cacheTtlMs: BOARD_CACHE_TTL_MS,
    useStaleWhileRevalidate: true,
    initialData: backendAssignmentFilter ? null : initialBoardData,
  });
  const membersQuery = useAuthenticatedApiResource({
    key: `workspace:${workspaceId}:members:board`,
    load: (accessToken) => getWorkspaceMembers(workspaceId, accessToken),
    cacheTtlMs: BOARD_CACHE_TTL_MS,
    useStaleWhileRevalidate: true,
    enabled: boardDataQuery.status === 'success' || initialBoardData !== null,
  });
  const members = membersQuery.status === 'success' ? membersQuery.data.members : null;
  const assigneeOptions = useMemo(
    () => buildBoardAssigneeOptions(members, auth.user),
    [auth.user, members],
  );
  const resolvedAssigneeFilter = useMemo(
    () => resolveBoardAssigneeFilter(assigneeOptions, assigneeFilter),
    [assigneeFilter, assigneeOptions],
  );
  const taskQueryKey = `workspace:${workspaceId}:tasks:board:${backendAssignmentFilter ?? 'everyone'}`;
  const baseTaskItems = boardDataQuery.status === 'success' ? boardDataQuery.data.tasks : [];
  const taskItems =
    taskItemsState.key === taskQueryKey
      ? mergeTaskListOverlay(baseTaskItems, taskItemsState.overlay)
      : baseTaskItems;

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
    if (boardDataQuery.status !== 'success') {
      setActionOverride(null);
      return;
    }

    setActionOverride({
      label: 'Create Task',
      icon: 'create',
      onAction: openCreateTaskModal,
    });

    return () => {
      setActionOverride(null);
    };
  }, [boardDataQuery.status, openCreateTaskModal, setActionOverride]);

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') {
      return;
    }

    if (boardDataQuery.status === 'error') {
      console.error('Failed to load workspace board data.', boardDataQuery.error);
    }
  }, [boardDataQuery.error, boardDataQuery.status]);

  return (
    <div className="mx-auto flex w-full max-w-[1520px] flex-col">
      {boardDataQuery.status === 'loading' ? <BoardLoadingState /> : null}

      {boardDataQuery.status === 'error' ? (
        <PageStatusCard
          title="Board unavailable"
          description={GENERIC_BOARD_ERROR_MESSAGE}
          tone="danger"
          actionLabel="Retry board"
          onAction={() => {
            setBoardRetryNonce((current) => current + 1);
          }}
        />
      ) : null}

      {boardDataQuery.status === 'success' ? (
        <div className="flex flex-col gap-3" data-perf-board-ready="true">
          {membersQuery.status === 'loading' ? (
            <PageSurface
              eyebrow="Loading filters"
              title="Members loading in background"
              description="The board is ready. Assignee-specific filters will appear as soon as members load."
            />
          ) : null}

          {membersQuery.status === 'error' ? (
            <PageSurface
              eyebrow="Limited filters"
              title="Members unavailable"
              description="Tasks are available, but member-specific filters are unavailable until workspace members can be loaded."
            />
          ) : null}

          {boardDataQuery.data.hasMore ? (
            <PageSurface
              eyebrow="Task list capped"
              title={`Showing the newest ${String(boardDataQuery.data.limit)} tasks`}
              description="This workspace has more tasks than the current response includes. Refine the board filters to narrow the list."
            />
          ) : null}

          <BoardPage
            workspace={boardDataQuery.data.workspace}
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
        members={members}
        membersUnavailable={membersQuery.status !== 'success'}
        onClose={closeCreateTaskModal}
        onCreated={(task) => {
          setTaskItemsState((current) => ({
            key: taskQueryKey,
            overlay: applyTaskOverlayMutation(
              current.key === taskQueryKey
                ? current.overlay
                : { tasks: [], removedTaskIds: [] },
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
        members={members}
        membersUnavailable={membersQuery.status !== 'success'}
        onClose={closeTaskDetailsModal}
        onTaskChanged={(task) => {
          setTaskItemsState((current) => ({
            key: taskQueryKey,
            overlay: applyTaskOverlayMutation(
              current.key === taskQueryKey
                ? current.overlay
                : { tasks: [], removedTaskIds: [] },
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
            overlay: applyTaskOverlayRemoval(
              current.key === taskQueryKey
                ? current.overlay
                : { tasks: [], removedTaskIds: [] },
              taskId,
            ),
          }));
        }}
      />
    </div>
  );
}
