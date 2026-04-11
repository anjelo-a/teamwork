'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageStatusCard } from '@/components/app-shell/page-state';
import { CreateWorkspaceModal } from '@/components/workspaces/create-workspace-modal';
import { useAuthSession } from '@/lib/auth/auth-session-provider';
import { getWorkspaceBoardHref } from '@/lib/app-shell';
import { resolveWorkspaceBoardRedirect } from '@/lib/auth/workspace-routing';

export default function HomePage() {
  const router = useRouter();
  const { status, auth, errorMessage, refreshSession } = useAuthSession();
  const [isCreateWorkspaceOpen, setIsCreateWorkspaceOpen] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/auth-required');
      return;
    }

    if (status !== 'authenticated') {
      return;
    }

    const destinationPath = resolveWorkspaceBoardRedirect(auth);

    if (!destinationPath) {
      return;
    }

    router.replace(destinationPath);
  }, [auth, router, status]);

  if (status === 'loading') {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 py-10">
        <PageStatusCard
          title="Loading your workspace"
          description="Checking your session and resolving the best landing route."
          tone="default"
        />
      </main>
    );
  }

  if (status === 'authenticated' && auth.workspaces.length === 0) {
    return (
      <>
        <main className="flex min-h-screen items-center justify-center px-6 py-10">
          <PageStatusCard
            title="No workspaces available"
            description="Your account is authenticated, but there is no workspace to open yet."
            tone="default"
            actionLabel="Create workspace"
            onAction={() => {
              setIsCreateWorkspaceOpen(true);
            }}
          />
        </main>
        <CreateWorkspaceModal
          open={isCreateWorkspaceOpen}
          onClose={() => {
            setIsCreateWorkspaceOpen(false);
          }}
          onCreated={(workspaceId) => {
            router.replace(getWorkspaceBoardHref(workspaceId));
          }}
        />
      </>
    );
  }

  if (status === 'error') {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 py-10">
        <PageStatusCard
          title="Session unavailable"
          description={errorMessage ?? 'The app could not validate your current session.'}
          tone="danger"
          actionLabel="Retry session"
          onAction={() => {
            void refreshSession();
          }}
        />
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-10">
      <PageStatusCard
        title="Preparing TeamWork"
        description="Taking you to the best available workspace."
        tone="default"
      />
    </main>
  );
}
