'use client';

import { InvitationInboxPage, InvitationInboxPageSkeleton } from '@/components/invitations/invitation-inbox-page';
import { PageContainer } from '@/components/app-shell/page-container';
import { PageStatusCard } from '@/components/app-shell/page-state';
import { listMyInvitationInbox } from '@/lib/api/client';
import { useAuthSession } from '@/lib/auth/auth-session-provider';
import { useAuthenticatedApiResource } from '@/lib/hooks/use-authenticated-api-resource';

export default function InvitationInboxRoutePage() {
  const { accessToken, refreshSession } = useAuthSession();
  const inboxQuery = useAuthenticatedApiResource({
    key: 'users:me:invitations',
    load: listMyInvitationInbox,
  });

  return (
    <PageContainer>
      {inboxQuery.status === 'loading' ? <InvitationInboxPageSkeleton /> : null}

      {inboxQuery.status === 'error' ? (
        <PageStatusCard
          title="Invitation inbox unavailable"
          description="Your received workspace invitations could not be loaded right now."
          tone="danger"
        />
      ) : null}

      {inboxQuery.status === 'success' ? (
        <InvitationInboxPage
          invitations={inboxQuery.data.invitations}
          accessToken={accessToken}
          refreshSession={refreshSession}
        />
      ) : null}
    </PageContainer>
  );
}
