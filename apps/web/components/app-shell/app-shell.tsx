'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AppShellHeader } from '@/components/app-shell/header';
import { PageStatusCard } from '@/components/app-shell/page-state';
import { SidebarNavigation } from '@/components/app-shell/sidebar';
import { CreateWorkspaceModal } from '@/components/workspaces/create-workspace-modal';
import { useAuthSession } from '@/lib/auth/auth-session-provider';
import { deriveShellRouteContext, getWorkspaceBoardHref } from '@/lib/app-shell';

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps): ReactNode {
  const pathname = usePathname();
  const router = useRouter();
  const { status, auth, errorMessage, refreshSession } = useAuthSession();
  const [isCreateWorkspaceOpen, setIsCreateWorkspaceOpen] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      const nextPath = encodeURIComponent(pathname || '/');
      router.replace(`/auth-required?next=${nextPath}`);
    }
  }, [pathname, router, status]);

  if (status === 'error') {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 py-10">
        <PageStatusCard
          title="Session unavailable"
          description={errorMessage ?? 'Your current session could not be validated.'}
          tone="danger"
          actionLabel="Retry session"
          onAction={() => {
            void refreshSession();
          }}
        />
      </main>
    );
  }

  if (status !== 'authenticated') {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 py-10">
        <PageStatusCard
          title="Loading TeamWork"
          description="Restoring your workspace access and account context."
          tone="default"
        />
      </main>
    );
  }

  if (auth.workspaces.length === 0) {
    return (
      <>
        <main className="flex min-h-screen items-center justify-center px-6 py-10">
          <PageStatusCard
            title="No workspaces available"
            description="Your account is active, but there is no workspace available yet."
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

  const routeContext = deriveShellRouteContext(pathname, auth.workspaces);

  return (
    <div className="flex min-h-screen gap-3.5 p-3.5 lg:gap-4 lg:p-4">
      <SidebarNavigation currentPath={pathname} currentWorkspace={routeContext.currentWorkspace} />
      <div className="shell-panel flex min-h-[calc(100vh-1.75rem)] flex-1 flex-col overflow-hidden rounded-[1.45rem] border border-line bg-surface-strong shadow-[var(--shadow)]">
        <AppShellHeader routeContext={routeContext} />
        <div className="shell-scrollbar shell-grid flex-1 overflow-y-auto px-4 py-4 lg:px-6 lg:py-5">
          {children}
        </div>
      </div>
    </div>
  );
}
