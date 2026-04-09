'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { CreateTaskModal } from '@/components/board/create-task-modal';
import { BoardLoadingState } from '@/components/board/board-loading';
import { BoardPage } from '@/components/board/board-page';
import { TaskDetailsModal } from '@/components/board/task-details-modal';
import { PageStatusCard, PageSurface } from '@/components/app-shell/page-state';
import { useAuthSession } from '@/lib/auth/auth-session-provider';
import {
  getWorkspaceBoardData,
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
import {
  applyTaskOverlayMutation,
  applyTaskOverlayRemoval,
  mergeTaskListOverlay,
  type TaskListOverlay,
} from '@/lib/task-list';

const STATUS_OPTIONS: BoardStatusFilter[] = ['all', 'todo', 'in_progress', 'done'];
const GENERIC_BOARD_ERROR_MESSAGE = 'This workspace board could not be loaded right now.';

export default function WorkspaceBoardPage() {
  const params = useParams<{ workspaceId: string }>();
  const workspaceId = readWorkspaceIdFromParams(params);
  const { auth } = useAuthSession();
  const [statusFilter, setStatusFilter] = useState(DEFAULT_BOARD_STATUS_FILTER);
  const [assigneeFilter, setAssigneeFilter] = useState(DEFAULT_BOARD_ASSIGNEE_FILTER);
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
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

  const assigneeOptions = useMemo(() => buildBoardAssigneeOptions(null, auth.user), [auth.user]);
  const resolvedAssigneeFilter = useMemo(
    () => resolveBoardAssigneeFilter(assigneeOptions, assigneeFilter),
    [assigneeFilter, assigneeOptions],
  );
  const backendAssignmentFilter = getBackendAssignmentFilter(resolvedAssigneeFilter);
  const boardQueryKey = `workspace:${workspaceId}:board-data:${backendAssignmentFilter ?? 'everyone'}`;

  const boardDataQuery = useAuthenticatedApiResource({
    key: boardQueryKey,
    load: (accessToken) =>
      getWorkspaceBoardData(
        workspaceId,
        accessToken,
        backendAssignmentFilter ? { assignment: backendAssignmentFilter } : undefined,
      ),
  });
  const members = boardDataQuery.status === 'success' ? boardDataQuery.data.members : null;
  const assigneeOptionsWithMembers = useMemo(
    () => buildBoardAssigneeOptions(members, auth.user),
    [auth.user, members],
  );
  const resolvedAssigneeFilterWithMembers = useMemo(
    () => resolveBoardAssigneeFilter(assigneeOptionsWithMembers, assigneeFilter),
    [assigneeFilter, assigneeOptionsWithMembers],
  );
  const backendAssignmentFilterWithMembers = getBackendAssignmentFilter(
    resolvedAssigneeFilterWithMembers,
  );
  const taskQueryKey = `workspace:${workspaceId}:tasks:board:${backendAssignmentFilterWithMembers ?? 'everyone'}`;
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
      {boardDataQuery.status === 'loading' ? (
        <BoardLoadingState />
      ) : null}

      {boardDataQuery.status === 'error' ? (
        <PageStatusCard
          title="Board unavailable"
          description={GENERIC_BOARD_ERROR_MESSAGE}
          tone="danger"
          actionLabel="Retry board"
          onAction={() => {
            window.location.reload();
          }}
        />
      ) : null}

      {boardDataQuery.status === 'success' ? (
        <div className="flex flex-col gap-3" data-perf-board-ready="true">
          {boardDataQuery.data.hasMore ? (
            <PageSurface
              eyebrow="Task list capped"
              title={`Showing the newest ${boardDataQuery.data.limit} tasks`}
              description="This workspace has more tasks than the current response includes. Refine the board filters to narrow the list."
            />
          ) : null}

          <BoardPage
            workspace={boardDataQuery.data.workspace}
            tasks={taskItems}
            assigneeFilter={resolvedAssigneeFilterWithMembers}
            assigneeOptions={assigneeOptionsWithMembers}
            statusFilter={statusFilter}
            statusOptions={STATUS_OPTIONS}
            currentUserId={auth.user.id}
            membersUnavailable={false}
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
        membersUnavailable={boardDataQuery.status !== 'success'}
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
                  backendAssignmentFilterWithMembers,
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
        membersUnavailable={boardDataQuery.status !== 'success'}
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
                  backendAssignmentFilterWithMembers,
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
