'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { ApiError, getWorkspaceInvitations, getWorkspaceMembers, getWorkspaceSecurityDashboard, getWorkspaceShareLink } from '@/lib/api/client';
import { PageContainer } from '@/components/app-shell/page-container';
import { PageStatusCard } from '@/components/app-shell/page-state';
import { WorkspaceSettingsPage, WorkspaceSettingsPageSkeleton } from '@/components/workspaces/workspace-settings-page';
import { useAuthSession } from '@/lib/auth/auth-session-provider';
import { useAuthenticatedApiResource } from '@/lib/hooks/use-authenticated-api-resource';
import { readWorkspaceIdFromParams } from '@/lib/route-params';

export default function WorkspaceSettingsRoutePage() {
  const params = useParams<{ workspaceId: string }>();
  const workspaceId = readWorkspaceIdFromParams(params);
  const { auth, accessToken, refreshSession } = useAuthSession();
  const currentWorkspace = useMemo(
    () => auth.workspaces.find((workspace) => workspace.id === workspaceId) ?? null,
    [auth.workspaces, workspaceId],
  );
  const isOwner = currentWorkspace?.membership.role === 'owner';

  const membersQuery = useAuthenticatedApiResource({
    key: `workspace:${workspaceId}:settings:members`,
    load: (accessToken) => getWorkspaceMembers(workspaceId, accessToken),
  });
  const invitationsQuery = useAuthenticatedApiResource({
    key: `workspace:${workspaceId}:settings:invitations`,
    load: (accessToken) => getWorkspaceInvitations(workspaceId, accessToken),
  });
  const shareLinkQuery = useAuthenticatedApiResource({
    key: `workspace:${workspaceId}:settings:share-link`,
    load: (accessToken) => getWorkspaceShareLink(workspaceId, accessToken),
  });
  const dashboardQuery = useAuthenticatedApiResource({
    key: `workspace:${workspaceId}:settings:security-dashboard`,
    load: (accessToken) => getWorkspaceSecurityDashboard(workspaceId, accessToken),
  });

  const queries = [membersQuery, invitationsQuery, shareLinkQuery, dashboardQuery] as const;
  const isLoading = queries.some((query) => query.status === 'loading');
  const firstError = queries.find((query) => query.status === 'error');
  const isForbidden =
    firstError?.status === 'error' &&
    firstError.error instanceof ApiError &&
    firstError.error.status === 403;

  return (
    <PageContainer>
      {isLoading ? <WorkspaceSettingsPageSkeleton /> : null}

      {!isLoading && !isOwner ? (
        <PageStatusCard
          title="Owner access required"
          description="Only workspace owners can access workspace settings and governance controls."
          tone="warning"
        />
      ) : null}

      {!isLoading && isOwner && isForbidden ? (
        <PageStatusCard
          title="Owner access required"
          description="Your current session no longer has owner access for this workspace."
          tone="warning"
        />
      ) : null}

      {!isLoading && !isForbidden && firstError ? (
        <PageStatusCard
          title="Settings unavailable"
          description="Workspace settings could not be loaded right now."
          tone="danger"
        />
      ) : null}

      {!isLoading &&
      !firstError &&
      membersQuery.status === 'success' &&
      invitationsQuery.status === 'success' &&
      shareLinkQuery.status === 'success' &&
      dashboardQuery.status === 'success' &&
      isOwner ? (
        <WorkspaceSettingsPage
          workspaceId={workspaceId}
          currentUserId={auth.user.id}
          members={membersQuery.data.members}
          pendingInvitationCount={invitationsQuery.data.invitations.length}
          shareLink={shareLinkQuery.data.shareLink}
          dashboard={dashboardQuery.data.dashboard}
          accessToken={accessToken}
          onOwnershipTransferred={async () => {
            await refreshSession();
          }}
        />
      ) : null}
    </PageContainer>
  );
}
