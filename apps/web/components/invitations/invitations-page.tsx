'use client';

import { memo, useCallback, useMemo, useState } from 'react';
import type {
  InviteWorkspaceMemberResult,
  WorkspaceInvitationSummary,
  WorkspaceRole,
  WorkspaceShareLinkSummary,
} from '@teamwork/types';
import {
  ApiError,
  disableWorkspaceShareLink,
  regenerateWorkspaceShareLink,
  revokeWorkspaceInvitation,
} from '@/lib/api/client';
import { InviteMemberModal } from '@/components/invitations/invite-member-modal';
import {
  ContentPanel,
  StatusBadge,
} from '@/components/app-shell/page-state';
import { AppButton, getIconButtonClassName } from '@/components/ui/button';
import { FormMessage } from '@/components/ui/form-controls';

interface InvitationsPageProps {
  workspaceId: string;
  invitations: WorkspaceInvitationSummary[];
  workspaceShareLink: WorkspaceShareLinkSummary | null;
  currentUserRole: WorkspaceRole | null;
  accessToken: string | null;
}

type RowState = Partial<Record<string, { isRevoking: boolean; errorMessage: string | null }>>;

export function InvitationsPage({
  workspaceId,
  invitations,
  workspaceShareLink,
  currentUserRole,
  accessToken,
}: InvitationsPageProps) {
  const [createdInvitations, setCreatedInvitations] = useState<WorkspaceInvitationSummary[]>([]);
  const [removedInvitationIds, setRemovedInvitationIds] = useState<Record<string, true>>({});
  const [rowState, setRowState] = useState<RowState>({});
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [successResult, setSuccessResult] = useState<InviteWorkspaceMemberResult | null>(null);
  const [shareLink, setShareLink] = useState<WorkspaceShareLinkSummary | null>(workspaceShareLink);
  const [shareLinkErrorMessage, setShareLinkErrorMessage] = useState<string | null>(null);
  const [isRegeneratingShareLink, setIsRegeneratingShareLink] = useState(false);
  const [isDisablingShareLink, setIsDisablingShareLink] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');
  const isOwner = currentUserRole === 'owner';

  const items = useMemo(() => {
    const visibleServerInvitations = invitations.filter(
      (invitation) => !removedInvitationIds[invitation.id],
    );
    const visibleCreatedInvitations = createdInvitations.filter(
      (invitation) => !removedInvitationIds[invitation.id],
    );
    const invitationMap = new Map<string, WorkspaceInvitationSummary>();

    for (const invitation of visibleCreatedInvitations) {
      invitationMap.set(invitation.id, invitation);
    }

    for (const invitation of visibleServerInvitations) {
      invitationMap.set(invitation.id, invitation);
    }

    return Array.from(invitationMap.values());
  }, [createdInvitations, invitations, removedInvitationIds]);

  const sortedItems = useMemo(
    () =>
      [...items].sort(
        (left, right) =>
          new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
      ),
    [items],
  );

  const handleRevoke = useCallback(
    async (invitation: WorkspaceInvitationSummary) => {
      if (!accessToken || !isOwner) {
        return;
      }

      setRowState((current) => ({
        ...current,
        [invitation.id]: {
          isRevoking: true,
          errorMessage: null,
        },
      }));

      try {
        await revokeWorkspaceInvitation(workspaceId, invitation.id, accessToken);
        setRemovedInvitationIds((current) => ({
          ...current,
          [invitation.id]: true,
        }));
        setCreatedInvitations((current) =>
          current.filter((createdInvitation) => createdInvitation.id !== invitation.id),
        );
        setRowState((current) => {
          const { [invitation.id]: removed, ...remaining } = current;
          void removed;
          return remaining;
        });
      } catch (error) {
        setRowState((current) => ({
          ...current,
          [invitation.id]: {
            isRevoking: false,
            errorMessage:
              error instanceof ApiError || error instanceof Error
                ? error.message
                : 'Invitation could not be canceled.',
          },
        }));
      }
    },
    [accessToken, isOwner, workspaceId],
  );

  const handleCopyInviteLink = useCallback(async () => {
    if (!shareLink?.url) {
      return;
    }

    try {
      await navigator.clipboard.writeText(shareLink.url);
      setCopyState('copied');
    } catch {
      setCopyState('error');
    }
  }, [shareLink]);

  const handleRegenerateShareLink = useCallback(async () => {
    if (!accessToken || !isOwner) {
      return;
    }

    setIsRegeneratingShareLink(true);
    setShareLinkErrorMessage(null);
    setCopyState('idle');

    try {
      const result = await regenerateWorkspaceShareLink(workspaceId, accessToken);
      setShareLink(result.shareLink);
    } catch (error) {
      setShareLinkErrorMessage(
        error instanceof ApiError || error instanceof Error
          ? error.message
          : 'Workspace share link could not be regenerated.',
      );
    } finally {
      setIsRegeneratingShareLink(false);
    }
  }, [accessToken, isOwner, workspaceId]);

  const handleDisableShareLink = useCallback(async () => {
    if (!accessToken || !isOwner || !shareLink) {
      return;
    }

    setIsDisablingShareLink(true);
    setShareLinkErrorMessage(null);
    setCopyState('idle');

    try {
      const result = await disableWorkspaceShareLink(workspaceId, accessToken);
      setShareLink(result.shareLink);
    } catch (error) {
      setShareLinkErrorMessage(
        error instanceof ApiError || error instanceof Error
          ? error.message
          : 'Workspace share link could not be disabled.',
      );
    } finally {
      setIsDisablingShareLink(false);
    }
  }, [accessToken, isOwner, shareLink, workspaceId]);

  return (
    <>
      {successResult ? (
        <FormMessage
          tone="info"
          message={`Invitation created for ${successResult.invitation.email}`}
        />
      ) : null}

      {isOwner ? (
        <ContentPanel>
          <div className="flex items-start justify-between gap-6 px-7 py-6">
            <div className="min-w-0">
              <h3 className="text-[1.18rem] font-semibold tracking-tight text-foreground">
                Invite a Member
              </h3>
              <p className="mt-2 max-w-2xl text-[0.92rem] leading-6 text-muted">
                Invite teammates by email or use the workspace share link available below.
              </p>
            </div>

            <AppButton
              type="button"
              onClick={() => {
                setIsInviteModalOpen(true);
                setCopyState('idle');
              }}
              className="shrink-0"
            >
              Send Invite
            </AppButton>
          </div>

          <div className="border-t border-line bg-surface-muted/45 px-7 py-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <p className="text-[0.95rem] font-semibold text-foreground">Invite by link</p>
                <p className="mt-1 text-[0.86rem] leading-6 text-muted">
                  Each workspace has a reusable share link. Anyone with access to this link can
                  join with the role selected here.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {shareLink ? (
                  <AppButton
                    type="button"
                    variant="secondary"
                    size="compact"
                    onClick={() => {
                      void handleRegenerateShareLink();
                    }}
                    disabled={isRegeneratingShareLink || isDisablingShareLink}
                  >
                    {isRegeneratingShareLink
                      ? 'Regenerating...'
                      : shareLink.status === 'active'
                        ? 'Regenerate'
                        : 'Create New Link'}
                  </AppButton>
                ) : null}
                {shareLink ? (
                  <AppButton
                    type="button"
                    variant="secondary"
                    size="compact"
                    onClick={() => {
                      void handleCopyInviteLink();
                    }}
                    disabled={
                      !shareLink.url || isRegeneratingShareLink || isDisablingShareLink
                    }
                    className="shrink-0"
                  >
                    Copy Link
                  </AppButton>
                ) : null}
                {shareLink ? (
                  <AppButton
                    type="button"
                    variant="secondary"
                    size="compact"
                    onClick={() => {
                      void handleDisableShareLink();
                    }}
                    disabled={
                      shareLink.status !== 'active' ||
                      isRegeneratingShareLink ||
                      isDisablingShareLink
                    }
                    className="shrink-0"
                  >
                    {isDisablingShareLink ? 'Disabling...' : 'Disable Link'}
                  </AppButton>
                ) : null}
              </div>
            </div>

            {shareLink ? (
              <>
                <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                  <div>
                    <span className="text-[0.82rem] font-semibold uppercase tracking-[0.18em] text-muted">
                      Access Role
                    </span>
                    <p className="mt-2 text-[0.94rem] font-medium text-foreground">
                      Member only
                    </p>
                  </div>
                  <div>
                    <span className="text-[0.82rem] font-semibold uppercase tracking-[0.18em] text-muted">
                      Link Status
                    </span>
                    <p className="mt-2 flex items-center gap-2 text-[0.94rem] font-medium text-foreground">
                      <StatusDot tone={shareLink.status} />
                      {formatShareLinkStatus(shareLink.status)}
                    </p>
                  </div>
                </div>
                <div className="mt-2.5 flex flex-wrap items-center gap-4 text-[0.8rem] text-muted">
                  <StatusLegendItem tone="active" label="Active" />
                  <StatusLegendItem tone="revoked" label="Disabled" />
                  <StatusLegendItem tone="expired" label="Expired" />
                </div>

                {shareLink.url ? (
                  <a
                    href={shareLink.url}
                    className="mt-3 block break-all text-[0.9rem] font-medium leading-6 text-accent underline decoration-transparent underline-offset-4 transition-colors hover:decoration-current"
                  >
                    {shareLink.url}
                  </a>
                ) : (
                  <div className="mt-3 rounded-[calc(var(--radius-control)+0.15rem)] border border-dashed border-line px-4 py-3 text-[0.85rem] leading-6 text-muted">
                    The raw link is only shown when a new link is created or regenerated. Create a
                    new link to copy and share it again.
                  </div>
                )}
                <p className="mt-2 text-[0.82rem] leading-5 text-muted">
                  Share links only grant member access. They expire on{' '}
                  {formatDate(shareLink.expiresAt)}, can be disabled at any time, and old links stop
                  working after regeneration.
                </p>
                {shareLink.lastUsedAt ? (
                  <p className="mt-2 text-[0.82rem] leading-5 text-muted">
                    Last used on {formatDate(shareLink.lastUsedAt)}.
                  </p>
                ) : null}
                {copyState === 'copied' ? (
                  <p className="mt-2 text-[0.82rem] leading-5 text-foreground">
                    Workspace link copied.
                  </p>
                ) : null}
                {copyState === 'error' ? (
                  <p className="mt-2 text-[0.82rem] leading-5 text-danger">
                    Workspace link could not be copied automatically.
                  </p>
                ) : null}
                {shareLinkErrorMessage ? (
                  <p className="mt-2 text-[0.82rem] leading-5 text-danger">
                    {shareLinkErrorMessage}
                  </p>
                ) : null}
              </>
            ) : (
              <div className="mt-3 rounded-[calc(var(--radius-control)+0.15rem)] border border-dashed border-line px-4 py-3 text-[0.85rem] leading-6 text-muted">
                Workspace share link unavailable right now.
              </div>
            )}
          </div>
        </ContentPanel>
      ) : null}

      <ContentPanel>
        {sortedItems.length === 0 ? (
          <div className="px-7 py-7">
            <p className="text-[1.05rem] font-semibold text-foreground">No pending invitations</p>
            <p className="mt-2 text-[0.9rem] leading-6 text-muted">
              New invitations will appear here after they are created.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-line">
            {sortedItems.map((invitation) => {
              const state = rowState[invitation.id];

              return (
                <InvitationRow
                  key={invitation.id}
                  invitation={invitation}
                  isOwner={isOwner}
                  isRevoking={state?.isRevoking ?? false}
                  errorMessage={state?.errorMessage ?? null}
                  onRevoke={handleRevoke}
                />
              );
            })}
          </div>
        )}
      </ContentPanel>

      <InviteMemberModal
        open={isInviteModalOpen}
        workspaceId={workspaceId}
        accessToken={accessToken}
        onClose={() => {
          setIsInviteModalOpen(false);
        }}
        onCreated={(result) => {
          setSuccessResult(result);
          setCopyState('idle');
          setRemovedInvitationIds((current) => {
            if (!current[result.invitation.id]) {
              return current;
            }

            const { [result.invitation.id]: _removed, ...remaining } = current;
            void _removed;
            return remaining;
          });
          setCreatedInvitations((current) => {
            const next = current.filter(
              (invitation) => invitation.id !== result.invitation.id,
            );
            next.push(result.invitation);
            return next;
          });
        }}
      />
    </>
  );
}

export function InvitationsPageSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-[1.5rem] border border-line bg-surface-strong shadow-[0_18px_38px_rgba(15,23,42,0.06)]">
        <div className="px-7 py-4.5">
          <div className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-3.5">
              <div className="h-11 w-11 animate-pulse rounded-full bg-black/10" />
              <div className="space-y-2">
                <div className="h-5 w-60 animate-pulse rounded-full bg-black/10" />
                <div className="h-4 w-32 animate-pulse rounded-full bg-black/5" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-7 w-18 animate-pulse rounded-full bg-black/5" />
              <div className="h-8 w-8 animate-pulse rounded-[0.8rem] bg-black/5" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

const InvitationRow = memo(function InvitationRow({
  invitation,
  isOwner,
  isRevoking,
  errorMessage,
  onRevoke,
}: {
  invitation: WorkspaceInvitationSummary;
  isOwner: boolean;
  isRevoking: boolean;
  errorMessage: string | null;
  onRevoke: (invitation: WorkspaceInvitationSummary) => Promise<void>;
}) {
  return (
    <div className="px-7 py-4.5">
      <div className="flex items-center justify-between gap-6">
        <div className="flex min-w-0 items-center gap-3.5">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface-muted text-muted">
            <InviteIcon />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[1.14rem] font-semibold tracking-tight text-foreground">
              {invitation.email}
            </p>
            <p className="truncate text-[0.9rem] leading-6 text-muted">
              Invited {formatInvitationDate(invitation.createdAt)}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <StatusBadge label="Pending" tone="success" />
          {isOwner ? (
            <button
              type="button"
              onClick={() => {
                void onRevoke(invitation);
              }}
              disabled={isRevoking}
              aria-label={`Cancel invitation for ${invitation.email}`}
              className={getIconButtonClassName()}
            >
              <CloseIcon />
            </button>
          ) : null}
        </div>
      </div>

      {errorMessage ? (
        <p className="mt-2.5 pl-14 text-[0.88rem] leading-6 text-danger">{errorMessage}</p>
      ) : null}
    </div>
  );
});

function formatShareLinkStatus(status: WorkspaceShareLinkSummary['status']): string {
  if (status === 'expired') {
    return 'Expired';
  }

  if (status === 'revoked') {
    return 'Disabled';
  }

  return 'Active';
}

function StatusLegendItem({
  tone,
  label,
}: {
  tone: WorkspaceShareLinkSummary['status'];
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <StatusDot tone={tone} />
      {label}
    </span>
  );
}

function StatusDot({
  tone,
}: {
  tone: WorkspaceShareLinkSummary['status'];
}) {
  const colorClassName =
    tone === 'active' ? 'bg-emerald-500' : tone === 'revoked' ? 'bg-rose-500' : 'bg-violet-500';

  return (
    <span
      className={`inline-flex h-2.5 w-2.5 rounded-full ${colorClassName}`}
      aria-hidden="true"
    />
  );
}

function InviteIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="M4.5 7.5h15v9h-15z" />
      <path d="m5.5 8.5 6.5 5 6.5-5" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="m7 7 10 10" />
      <path d="M17 7 7 17" />
    </svg>
  );
}

function formatInvitationDate(value: string): string {
  return INVITATION_DATE_FORMATTER.format(new Date(value));
}

function formatDate(value: string): string {
  return INVITATION_DATE_FORMATTER.format(new Date(value));
}

const INVITATION_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'numeric',
  day: 'numeric',
  year: 'numeric',
});
