'use client';

import { useState } from 'react';
import type { TaskSummary } from '@teamwork/types';
import { TaskDetailsModal } from '@/components/board/task-details-modal';
import { TaskInboxPage, TaskInboxPageSkeleton } from '@/components/inbox/task-inbox-page';
import { PageContainer } from '@/components/app-shell/page-container';
import { PageStatusCard, PageSurface } from '@/components/app-shell/page-state';
import { useAuthSession } from '@/lib/auth/auth-session-provider';
import { useAuthenticatedApiResource } from '@/lib/hooks/use-authenticated-api-resource';
import { getWorkspaceMembers, listInboxTasks } from '@/lib/api/client';
import {
  applyTaskOverlayMutation,
  applyTaskOverlayRemoval,
  mergeTaskListOverlay,
  type TaskListOverlay,
} from '@/lib/task-list';

export default function InboxPage() {
  const { auth } = useAuthSession();
  const [selectedTask, setSelectedTask] = useState<TaskSummary | null>(null);
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
  const taskQueryKey = 'tasks:inbox';
  const inboxQuery = useAuthenticatedApiResource({
    key: taskQueryKey,
    load: listInboxTasks,
  });
  const selectedWorkspaceMembersQuery = useAuthenticatedApiResource({
    key: `workspace:${selectedTask?.workspaceId ?? 'none'}:members:inbox`,
    load: (accessToken) =>
      selectedTask
        ? getWorkspaceMembers(selectedTask.workspaceId, accessToken)
        : Promise.resolve({ members: [] }),
  });
  const baseTaskItems = inboxQuery.status === 'success' ? inboxQuery.data.tasks : [];
  const taskItems =
    taskItemsState.key === taskQueryKey
      ? mergeTaskListOverlay(baseTaskItems, taskItemsState.overlay)
      : baseTaskItems;

  return (
    <PageContainer>
      {inboxQuery.status === 'loading' ? <TaskInboxPageSkeleton /> : null}

      {inboxQuery.status === 'error' ? (
        <PageStatusCard
          title="Inbox unavailable"
          description="Your task inbox could not be loaded right now."
          tone="danger"
        />
      ) : null}

      {inboxQuery.status === 'success' && taskItems.length === 0 ? (
        <PageStatusCard
          title="No inbox tasks"
          description="There are no tasks available across your accessible workspaces."
          tone="default"
        />
      ) : null}

      {inboxQuery.status === 'success' && taskItems.length > 0 ? (
        <>
          {inboxQuery.data.hasMore ? (
            <PageSurface
              eyebrow="Task list capped"
              title={`Showing the newest ${String(inboxQuery.data.limit)} tasks`}
              description="Your inbox has additional tasks beyond this response. Narrow the view from a workspace board or calendar to work through the rest."
            />
          ) : null}

          <TaskInboxPage
            tasks={taskItems}
            workspaces={auth.workspaces}
            onTaskOpen={setSelectedTask}
          />
        </>
      ) : null}

      <TaskDetailsModal
        open={selectedTask !== null}
        taskId={selectedTask?.id ?? null}
        workspaceId={selectedTask?.workspaceId ?? ''}
        members={
          selectedWorkspaceMembersQuery.status === 'success'
            ? selectedWorkspaceMembersQuery.data.members
            : null
        }
        membersUnavailable={selectedWorkspaceMembersQuery.status === 'error'}
        onClose={() => {
          setSelectedTask(null);
        }}
        onTaskChanged={(task) => {
          setSelectedTask(task);
          setTaskItemsState((current) => ({
            key: taskQueryKey,
            overlay: applyTaskOverlayMutation(
              current.key === taskQueryKey
                ? current.overlay
                : { tasks: [], removedTaskIds: [] },
              task,
            ),
          }));
        }}
        onTaskDeleted={(taskId) => {
          setSelectedTask(null);
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
    </PageContainer>
  );
}
