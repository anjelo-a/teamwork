'use client';

import { useEffect, useMemo, useState } from 'react';
import type {
  InviteWorkspaceMemberResult,
  WorkspaceInvitationSummary,
  WorkspaceRole,
} from '@teamwork/types';
import { ApiError, revokeWorkspaceInvitation } from '@/lib/api/client';
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
  currentUserRole: WorkspaceRole | null;
  accessToken: string | null;
}

type RowState = Partial<Record<string, { isRevoking: boolean; errorMessage: string | null }>>;

export function InvitationsPage({
  workspaceId,
  invitations,
  currentUserRole,
  accessToken,
}: InvitationsPageProps) {
  const [items, setItems] = useState(invitations);
  const [rowState, setRowState] = useState<RowState>({});
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [successResult, setSuccessResult] = useState<InviteWorkspaceMemberResult | null>(null);
  const isOwner = currentUserRole === 'owner';

  useEffect(() => {
    setItems(invitations);
  }, [invitations]);

  const sortedItems = useMemo(
    () =>
      [...items].sort(
        (left, right) =>
          new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
      ),
    [items],
  );

  const handleRevoke = async (invitation: WorkspaceInvitationSummary) => {
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
      setItems((current) => current.filter((item) => item.id !== invitation.id));
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
  };

  return (
    <>
      <section className="flex items-start justify-between gap-5">
        <div>
          <h2 className="text-[1.82rem] font-semibold tracking-tight text-foreground">
            Invitations
          </h2>
          <p className="mt-1.5 text-[0.98rem] leading-6 text-muted">
            Invite new members to your workspace
          </p>
        </div>

        {isOwner ? (
          <AppButton
            type="button"
            onClick={() => {
              setIsInviteModalOpen(true);
            }}
            className="min-h-10 px-5 text-[0.95rem]"
          >
            Invite Member
          </AppButton>
        ) : null}
      </section>

      {successResult ? (
        <FormMessage
          tone="info"
          message={`Invitation created for ${successResult.invitation.email}`}
        />
      ) : null}

      {successResult ? (
        <section className="rounded-[calc(var(--radius-control)+0.3rem)] border border-line bg-[var(--color-info-soft)] px-6 py-5">
          <p className="text-[0.88rem] font-semibold text-foreground">
            Share this invitation link:
          </p>
          <a
            href={successResult.inviteUrl}
            className="mt-2 block break-all text-[0.88rem] font-medium leading-6 text-accent underline decoration-transparent underline-offset-4 transition-colors hover:decoration-current"
          >
            {successResult.inviteUrl}
          </a>
        </section>
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
          setItems((current) => [...current, result.invitation]);
        }}
      />
    </>
  );
}

export function InvitationsPageSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <section className="flex items-start justify-between gap-5">
        <div>
          <div className="h-9 w-40 animate-pulse rounded-xl bg-black/10" />
          <div className="mt-2.5 h-5 w-72 animate-pulse rounded-xl bg-black/5" />
        </div>
        <div className="h-10 w-32 animate-pulse rounded-[0.85rem] bg-black/10" />
      </section>

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

function InvitationRow({
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
  return new Intl.DateTimeFormat('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}
