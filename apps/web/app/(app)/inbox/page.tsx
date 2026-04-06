'use client';

import { useState } from 'react';
import type { TaskSummary } from '@teamwork/types';
import { TaskDetailsModal } from '@/components/board/task-details-modal';
import { TaskInboxPage, TaskInboxPageSkeleton } from '@/components/inbox/task-inbox-page';
import { PageContainer } from '@/components/app-shell/page-container';
import { PageStatusCard } from '@/components/app-shell/page-state';
import { useAuthSession } from '@/lib/auth/auth-session-provider';
import { useAuthenticatedApiResource } from '@/lib/hooks/use-authenticated-api-resource';
import { getWorkspaceMembers, listInboxTasks } from '@/lib/api/client';
import { removeTaskSummary, upsertTaskSummary } from '@/lib/task-list';

export default function InboxPage() {
  const { auth } = useAuthSession();
  const [selectedTask, setSelectedTask] = useState<TaskSummary | null>(null);
  const [taskItemsState, setTaskItemsState] = useState<{
    key: string | null;
    tasks: TaskSummary[];
  }>({
    key: null,
    tasks: [],
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
  const taskItems =
    taskItemsState.key === taskQueryKey
      ? taskItemsState.tasks
      : inboxQuery.status === 'success'
        ? inboxQuery.data.tasks
        : [];

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
        <TaskInboxPage
          tasks={taskItems}
          workspaces={auth.workspaces}
          onTaskOpen={setSelectedTask}
        />
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
            tasks: upsertTaskSummary(current.key === taskQueryKey ? current.tasks : taskItems, task),
          }));
        }}
        onTaskDeleted={(taskId) => {
          setSelectedTask(null);
          setTaskItemsState((current) => ({
            key: taskQueryKey,
            tasks: removeTaskSummary(current.key === taskQueryKey ? current.tasks : taskItems, taskId),
          }));
        }}
      />
    </PageContainer>
  );
}
