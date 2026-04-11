'use client';

import { useParams } from 'next/navigation';
import { PublicWorkspaceTokenPage } from '@/components/invitations/public-workspace-token-page';

export default function WorkspaceInvitationPage() {
  const params = useParams<{ token: string }>();
  const token = typeof params.token === 'string' ? params.token : '';

  return <PublicWorkspaceTokenPage token={token} source="invitation" />;
}
