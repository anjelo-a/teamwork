'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { MembersPage, MembersPageSkeleton } from '@/components/members/members-page';
import { PageContainer } from '@/components/app-shell/page-container';
import { PageStatusCard } from '@/components/app-shell/page-state';
import { getWorkspaceMembers } from '@/lib/api/client';
import { useAuthSession } from '@/lib/auth/auth-session-provider';
import { useAuthenticatedApiResource } from '@/lib/hooks/use-authenticated-api-resource';
import { readWorkspaceIdFromParams } from '@/lib/route-params';

export default function WorkspaceMembersPage() {
  const params = useParams<{ workspaceId: string }>();
  const workspaceId = readWorkspaceIdFromParams(params);
  const { auth, accessToken } = useAuthSession();
  const membersQuery = useAuthenticatedApiResource({
    key: `workspace:${workspaceId}:members`,
    load: (accessToken) => getWorkspaceMembers(workspaceId, accessToken),
  });
  const currentWorkspace = useMemo(
    () => auth.workspaces.find((workspace) => workspace.id === workspaceId) ?? null,
    [auth.workspaces, workspaceId],
  );

  return (
    <PageContainer>
      {membersQuery.status === 'loading' ? <MembersPageSkeleton /> : null}

      {membersQuery.status === 'error' ? (
        <PageStatusCard
          title="Members unavailable"
          description="The shell could not load workspace members from the backend."
          tone="danger"
        />
      ) : null}

      {membersQuery.status === 'success' && membersQuery.data.members.length === 0 ? (
        <PageStatusCard
          title="No members found"
          description="This workspace returned no members from the backend."
          tone="default"
        />
      ) : null}

      {membersQuery.status === 'success' && membersQuery.data.members.length > 0 ? (
        <MembersPage
          workspaceId={workspaceId}
          members={membersQuery.data.members}
          currentUserRole={currentWorkspace?.membership.role ?? null}
          accessToken={accessToken}
        />
      ) : null}
    </PageContainer>
  );
}
