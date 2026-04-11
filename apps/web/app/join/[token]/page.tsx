'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { PublicWorkspaceShareLinkLookup } from '@teamwork/types';
import {
  acceptWorkspaceShareLinkByToken,
  ApiError,
  getPublicWorkspaceShareLink,
} from '@/lib/api/client';
import { PageStatusCard } from '@/components/app-shell/page-state';
import { FormMessage } from '@/components/ui/form-controls';
import { AppButton } from '@/components/ui/button';
import { useAuthSession } from '@/lib/auth/auth-session-provider';
import { getWorkspaceBoardHref } from '@/lib/app-shell';

export default function WorkspaceJoinPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const { status, auth, accessToken, refreshSession } = useAuthSession();
  const token = typeof params.token === 'string' ? params.token : '';
  const [lookupRequestState, setLookupRequestState] = useState<{
    token: string;
    state: 'loading' | 'success' | 'error';
    lookup: PublicWorkspaceShareLinkLookup | null;
    error: string | null;
  }>({
    token,
    state: 'loading',
    lookup: null,
    error: null,
  });
  const [joinError, setJoinError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    let isActive = true;

    void getPublicWorkspaceShareLink(token)
      .then((result) => {
        if (!isActive) {
          return;
        }

        setLookupRequestState({
          token,
          state: 'success',
          lookup: result,
          error: null,
        });
      })
      .catch((error: unknown) => {
        if (!isActive) {
          return;
        }

        setLookupRequestState({
          token,
          state: 'error',
          lookup: null,
          error:
            error instanceof ApiError || error instanceof Error
              ? error.message
              : 'Workspace share link could not be loaded.',
        });
      });

    return () => {
      isActive = false;
    };
  }, [token]);

  const isCurrentLookupState = lookupRequestState.token === token;
  const lookupState = isCurrentLookupState ? lookupRequestState.state : 'loading';
  const lookup = isCurrentLookupState ? lookupRequestState.lookup : null;
  const lookupError = isCurrentLookupState ? lookupRequestState.error : null;
  const existingWorkspace = lookup
    ? auth.workspaces.find((workspace) => workspace.id === lookup.workspace.id) ?? null
    : null;
  const nextPath = `/join/${encodeURIComponent(token)}`;

  if (lookupState === 'loading') {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 py-10">
        <PageStatusCard
          title="Loading workspace link"
          description="Checking this workspace share link."
          tone="default"
        />
      </main>
    );
  }

  if (lookupState === 'error' || !lookup) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 py-10">
        <PageStatusCard
          title="Workspace link unavailable"
          description={lookupError ?? 'This workspace share link is not available.'}
          tone="danger"
        />
      </main>
    );
  }

  const isShareLinkActive = lookup.status === 'active';

  if (status === 'loading') {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 py-10">
        <PageStatusCard
          title="Checking your session"
          description="Preparing the right join action for this workspace."
          tone="default"
        />
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-10">
      <section className="w-full max-w-[620px] rounded-[var(--radius-panel)] border border-line bg-surface-strong px-8 py-8 shadow-[var(--panel-shadow)]">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">
          Workspace Invite
        </p>
        <h1 className="mt-3 text-[2rem] font-semibold tracking-tight text-foreground">
          Join {lookup.workspace.name}
        </h1>
        <p className="mt-2 text-[0.96rem] leading-7 text-muted">
          This workspace share link grants{' '}
          <span className="font-semibold text-foreground">{lookup.shareLink.role}</span> access.
        </p>
        <p className="mt-2 text-[0.9rem] leading-6 text-muted">
          Status: <span className="font-medium text-foreground">{formatStatus(lookup.status)}</span>
          {' '}· Expires {formatDate(lookup.shareLink.expiresAt)}
        </p>
        {lookup.shareLink.lastUsedAt ? (
          <p className="mt-2 text-[0.9rem] leading-6 text-muted">
            Last used {formatDate(lookup.shareLink.lastUsedAt)}.
          </p>
        ) : null}

        {joinError ? <FormMessage message={joinError} /> : null}

        <div className="mt-6 flex flex-wrap gap-3">
          {existingWorkspace ? (
            <AppButton
              type="button"
              onClick={() => {
                router.push(getWorkspaceBoardHref(existingWorkspace.id));
              }}
            >
              Open Workspace
            </AppButton>
          ) : null}

          {status === 'authenticated' && !existingWorkspace && isShareLinkActive ? (
            <AppButton
              type="button"
              disabled={isJoining || !accessToken}
              onClick={() => {
                setIsJoining(true);
                setJoinError(null);

                void acceptWorkspaceShareLinkByToken(token, accessToken ?? '')
                  .then(async () => {
                    await refreshSession();
                    router.replace(getWorkspaceBoardHref(lookup.workspace.id));
                  })
                  .catch((error: unknown) => {
                    setJoinError(
                      error instanceof ApiError || error instanceof Error
                        ? error.message
                        : 'Workspace could not be joined.',
                    );
                  })
                  .finally(() => {
                    setIsJoining(false);
                  });
              }}
            >
              {isJoining ? 'Joining...' : 'Join Workspace'}
            </AppButton>
          ) : null}

          {!isShareLinkActive ? (
            <PageStatusCard
              title="Workspace link inactive"
              description={
                lookup.status === 'expired'
                  ? 'This workspace share link has expired. Ask a workspace owner for a new one.'
                  : 'This workspace share link has been disabled. Ask a workspace owner for a new one.'
              }
              tone="warning"
            />
          ) : null}

          {status !== 'authenticated' && isShareLinkActive ? (
            <>
              <AppButton
                type="button"
                onClick={() => {
                  router.push(`/auth-required?next=${encodeURIComponent(nextPath)}`);
                }}
              >
                Sign In To Join
              </AppButton>
              <AppButton
                type="button"
                variant="secondary"
                onClick={() => {
                  router.push(`/sign-up?next=${encodeURIComponent(nextPath)}`);
                }}
              >
                Create Account
              </AppButton>
            </>
          ) : null}
        </div>
      </section>
    </main>
  );
}

const DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

function formatDate(value: string): string {
  return DATE_FORMATTER.format(new Date(value));
}

function formatStatus(status: PublicWorkspaceShareLinkLookup['status']): string {
  if (status === 'expired') {
    return 'Expired';
  }

  if (status === 'revoked') {
    return 'Disabled';
  }

  return 'Active';
}
