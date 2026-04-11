'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type {
  PublicWorkspaceInvitationLookup,
  PublicWorkspaceShareLinkLookup,
  WorkspaceRole,
} from '@teamwork/types';
import {
  acceptWorkspaceInvitationByToken,
  acceptWorkspaceShareLinkByToken,
  ApiError,
  getPublicWorkspaceInvitation,
  getPublicWorkspaceShareLink,
} from '@/lib/api/client';
import { PageStatusCard } from '@/components/app-shell/page-state';
import { FormMessage } from '@/components/ui/form-controls';
import { AppButton } from '@/components/ui/button';
import { useAuthSession } from '@/lib/auth/auth-session-provider';
import { getWorkspaceBoardHref } from '@/lib/app-shell';
import { resolveWorkspaceBoardRedirect } from '@/lib/auth/workspace-routing';

export type PublicWorkspaceTokenSource = 'share-link' | 'invitation';

interface PublicWorkspaceTokenPageProps {
  token: string;
  source: PublicWorkspaceTokenSource;
}

type PublicWorkspaceTokenStatus = 'active' | 'pending' | 'accepted' | 'revoked' | 'expired';

interface PublicWorkspaceTokenLookup {
  workspace: {
    id: string;
    name: string;
  };
  role: WorkspaceRole;
  status: PublicWorkspaceTokenStatus;
  expiresAt: string;
  lastUsedAt: string | null;
}

export function PublicWorkspaceTokenPage({
  token,
  source,
}: PublicWorkspaceTokenPageProps) {
  const router = useRouter();
  const { status, auth, accessToken, refreshSession } = useAuthSession();
  const [lookupRequestState, setLookupRequestState] = useState<{
    token: string;
    source: PublicWorkspaceTokenSource;
    state: 'loading' | 'success' | 'error';
    lookup: PublicWorkspaceTokenLookup | null;
    error: string | null;
  }>({
    token,
    source,
    state: 'loading',
    lookup: null,
    error: null,
  });
  const [joinError, setJoinError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    let isActive = true;

    const request =
      source === 'share-link'
        ? getPublicWorkspaceShareLink(token).then(normalizeShareLinkLookup)
        : getPublicWorkspaceInvitation(token).then(normalizeInvitationLookup);

    void request
      .then((result) => {
        if (!isActive) {
          return;
        }

        setLookupRequestState({
          token,
          source,
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
          source,
          state: 'error',
          lookup: null,
          error:
            error instanceof ApiError || error instanceof Error
              ? error.message
              : 'Workspace link could not be loaded.',
        });
      });

    return () => {
      isActive = false;
    };
  }, [source, token]);

  const isCurrentLookupState =
    lookupRequestState.token === token && lookupRequestState.source === source;
  const lookupState = isCurrentLookupState ? lookupRequestState.state : 'loading';
  const lookup = isCurrentLookupState ? lookupRequestState.lookup : null;
  const lookupError = isCurrentLookupState ? lookupRequestState.error : null;
  const existingWorkspace = lookup
    ? auth.workspaces.find((workspace) => workspace.id === lookup.workspace.id) ?? null
    : null;
  const nextPath = `/${source === 'invitation' ? 'invite' : 'join'}/${encodeURIComponent(token)}`;
  const entryLabel = source === 'invitation' ? 'workspace invitation' : 'workspace share link';

  if (lookupState === 'loading') {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 py-10">
        <PageStatusCard
          title="Loading workspace link"
          description={`Checking this ${entryLabel}.`}
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
          description={lookupError ?? `This ${entryLabel} is not available.`}
          tone="danger"
        />
      </main>
    );
  }

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

  const isAccessActive = lookup.status === 'active' || lookup.status === 'pending';
  const inactiveState = getInactiveState(source, lookup.status);

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-10">
      <section className="w-full max-w-[620px] rounded-[var(--radius-panel)] border border-line bg-surface-strong px-8 py-8 shadow-[var(--panel-shadow)]">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">
          {source === 'invitation' ? 'Email Invitation' : 'Workspace Invite'}
        </p>
        <h1 className="mt-3 text-[2rem] font-semibold tracking-tight text-foreground">
          Join {lookup.workspace.name}
        </h1>
        <p className="mt-2 text-[0.96rem] leading-7 text-muted">
          This {entryLabel} grants{' '}
          <span className="font-semibold text-foreground">{lookup.role}</span> access.
        </p>
        <p className="mt-2 text-[0.9rem] leading-6 text-muted">
          Status: <span className="font-medium text-foreground">{formatStatus(lookup.status)}</span>
          {' '}· Expires {formatDate(lookup.expiresAt)}
        </p>
        {lookup.lastUsedAt ? (
          <p className="mt-2 text-[0.9rem] leading-6 text-muted">
            Last used {formatDate(lookup.lastUsedAt)}.
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

          {status === 'authenticated' && !existingWorkspace && isAccessActive ? (
            <AppButton
              type="button"
              disabled={isJoining || !accessToken}
              onClick={() => {
                setIsJoining(true);
                setJoinError(null);

                const acceptRequest =
                  source === 'share-link'
                    ? acceptWorkspaceShareLinkByToken(token, accessToken ?? '')
                    : acceptWorkspaceInvitationByToken(token, accessToken ?? '');

                void acceptRequest
                  .then(async () => {
                    const nextSession = await refreshSession();

                    if (nextSession.status !== 'authenticated') {
                      router.replace(`/auth-required?next=${encodeURIComponent(nextPath)}`);
                      return;
                    }

                    const destinationPath = resolveWorkspaceBoardRedirect(
                      nextSession.auth,
                      lookup.workspace.id,
                    );
                    router.replace(destinationPath ?? '/');
                  })
                  .catch(async (error: unknown) => {
                    if (error instanceof ApiError && error.status === 409) {
                      const nextSession = await refreshSession();

                      if (nextSession.status === 'authenticated') {
                        const destinationPath = resolveWorkspaceBoardRedirect(
                          nextSession.auth,
                          lookup.workspace.id,
                        );

                        if (destinationPath) {
                          router.replace(destinationPath);
                          return;
                        }
                      }
                    }

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

          {!isAccessActive && inactiveState ? (
            <PageStatusCard
              title={inactiveState.title}
              description={inactiveState.description}
              tone="warning"
            />
          ) : null}

          {status !== 'authenticated' && isAccessActive ? (
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

function normalizeInvitationLookup(
  lookup: PublicWorkspaceInvitationLookup,
): PublicWorkspaceTokenLookup {
  return {
    workspace: {
      id: lookup.workspace.id,
      name: lookup.workspace.name,
    },
    role: lookup.invitation.role,
    status: lookup.status,
    expiresAt: lookup.invitation.expiresAt,
    lastUsedAt: null,
  };
}

function normalizeShareLinkLookup(
  lookup: PublicWorkspaceShareLinkLookup,
): PublicWorkspaceTokenLookup {
  return {
    workspace: {
      id: lookup.workspace.id,
      name: lookup.workspace.name,
    },
    role: lookup.shareLink.role,
    status: lookup.status,
    expiresAt: lookup.shareLink.expiresAt,
    lastUsedAt: lookup.shareLink.lastUsedAt,
  };
}

const DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

function formatDate(value: string): string {
  return DATE_FORMATTER.format(new Date(value));
}

function formatStatus(status: PublicWorkspaceTokenStatus): string {
  if (status === 'expired') {
    return 'Expired';
  }

  if (status === 'revoked') {
    return 'Disabled';
  }

  if (status === 'accepted') {
    return 'Accepted';
  }

  if (status === 'pending') {
    return 'Pending';
  }

  return 'Active';
}

function getInactiveState(
  source: PublicWorkspaceTokenSource,
  status: PublicWorkspaceTokenStatus,
): { title: string; description: string } | null {
  if (status === 'active' || status === 'pending') {
    return null;
  }

  if (source === 'invitation') {
    if (status === 'accepted') {
      return {
        title: 'Invitation already used',
        description: 'This invitation has already been accepted.',
      };
    }

    if (status === 'expired') {
      return {
        title: 'Invitation expired',
        description: 'This invitation has expired. Ask a workspace owner for a new one.',
      };
    }

    return {
      title: 'Invitation revoked',
      description: 'This invitation has been revoked. Ask a workspace owner for a new one.',
    };
  }

  if (status === 'expired') {
    return {
      title: 'Workspace link inactive',
      description: 'This workspace share link has expired. Ask a workspace owner for a new one.',
    };
  }

  return {
    title: 'Workspace link inactive',
    description: 'This workspace share link has been disabled. Ask a workspace owner for a new one.',
  };
}
