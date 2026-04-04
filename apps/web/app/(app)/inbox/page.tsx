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

export default function InboxPage() {
  const { auth } = useAuthSession();
  const [selectedTask, setSelectedTask] = useState<TaskSummary | null>(null);
  const [taskRefreshNonce, setTaskRefreshNonce] = useState(0);
  const inboxQuery = useAuthenticatedApiResource({
    key: `tasks:inbox:${String(taskRefreshNonce)}`,
    load: listInboxTasks,
  });
  const selectedWorkspaceMembersQuery = useAuthenticatedApiResource({
    key: `workspace:${selectedTask?.workspaceId ?? 'none'}:members:inbox`,
    load: (accessToken) =>
      selectedTask
        ? getWorkspaceMembers(selectedTask.workspaceId, accessToken)
        : Promise.resolve({ members: [] }),
  });

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

      {inboxQuery.status === 'success' && inboxQuery.data.tasks.length === 0 ? (
        <PageStatusCard
          title="No inbox tasks"
          description="There are no tasks available across your accessible workspaces."
          tone="default"
        />
      ) : null}

      {inboxQuery.status === 'success' && inboxQuery.data.tasks.length > 0 ? (
        <TaskInboxPage
          tasks={inboxQuery.data.tasks}
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
        onTaskChanged={() => {
          setTaskRefreshNonce((current) => current + 1);
        }}
        onTaskDeleted={() => {
          setSelectedTask(null);
          setTaskRefreshNonce((current) => current + 1);
        }}
      />
    </PageContainer>
  );
}
