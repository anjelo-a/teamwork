'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PageStatusCard } from '@/components/app-shell/page-state';
import { useAuthSession } from '@/lib/auth/auth-session-provider';
import { resolveWorkspaceBoardRedirect } from '@/lib/auth/workspace-routing';

export function AuthRedirectGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status, auth, errorMessage, clearSession } = useAuthSession();

  useEffect(() => {
    if (status !== 'authenticated') {
      return;
    }

    const nextPath = searchParams.get('next');

    if (isSafeInternalPath(nextPath)) {
      router.replace(nextPath);
      return;
    }

    const destinationPath = resolveWorkspaceBoardRedirect(auth);
    router.replace(destinationPath ?? '/');
  }, [auth, router, searchParams, status]);

  if (status === 'loading') {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 py-12">
        <PageStatusCard
          title="Checking your session"
          description="Preparing the right authentication route for this browser."
          tone="default"
        />
      </main>
    );
  }

  if (status === 'error') {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 py-12">
        <div className="w-full max-w-[460px]">
          <PageStatusCard
            title="Saved session unavailable"
            description={
              errorMessage ??
              'The current saved session could not be restored. You can clear it and sign in again.'
            }
            tone="warning"
            actionLabel="Clear saved session"
            onAction={clearSession}
          />
        </div>
      </main>
    );
  }

  if (status === 'authenticated') {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 py-12">
        <PageStatusCard
          title="Opening TeamWork"
          description="Routing your authenticated session into the app."
          tone="default"
        />
      </main>
    );
  }

  return <>{children}</>;
}

function isSafeInternalPath(value: string | null): value is string {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//');
}
