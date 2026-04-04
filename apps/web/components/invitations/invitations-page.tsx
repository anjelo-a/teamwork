'use client';

import { useEffect, useMemo, useState } from 'react';
import type {
  InviteWorkspaceMemberResult,
  WorkspaceInvitationSummary,
  WorkspaceRole,
} from '@teamwork/types';
import { ApiError, revokeWorkspaceInvitation } from '@/lib/api/client';
import { InviteMemberModal } from '@/components/invitations/invite-member-modal';

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
      <section className="flex items-start justify-between gap-6">
        <div>
          <h2 className="text-[2rem] font-semibold tracking-tight text-foreground">
            Invitations
          </h2>
          <p className="mt-2 text-[1.08rem] leading-7 text-[#8a98af]">
            Invite new members to your workspace
          </p>
        </div>

        {isOwner ? (
          <button
            type="button"
            onClick={() => {
              setIsInviteModalOpen(true);
            }}
            className="inline-flex min-h-12 items-center justify-center rounded-[0.95rem] bg-[#334158] px-6 text-base font-semibold text-white transition-colors hover:bg-[#253147]"
          >
            Invite Member
          </button>
        ) : null}
      </section>

      {successResult ? (
        <section className="rounded-[1.25rem] border border-line bg-[#edf9ff] px-6 py-5">
          <p className="text-sm font-semibold text-foreground">
            Invitation created for {successResult.invitation.email}
          </p>
          <p className="mt-2 text-sm leading-6 text-[#6d7e95]">
            Share this invitation link:
          </p>
          <a
            href={successResult.inviteUrl}
            className="mt-2 block break-all text-sm font-medium text-accent underline decoration-transparent underline-offset-4 transition-colors hover:decoration-current"
          >
            {successResult.inviteUrl}
          </a>
        </section>
      ) : null}

      <section className="rounded-[1.5rem] border border-line bg-surface-strong shadow-[0_18px_38px_rgba(15,23,20,0.06)]">
        {sortedItems.length === 0 ? (
          <div className="px-8 py-8">
            <p className="text-lg font-semibold text-foreground">No pending invitations</p>
            <p className="mt-2 text-sm leading-6 text-muted">
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
      </section>

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
    <div className="flex flex-col gap-6">
      <section className="flex items-start justify-between gap-6">
        <div>
          <div className="h-10 w-44 animate-pulse rounded-2xl bg-black/10" />
          <div className="mt-3 h-6 w-80 animate-pulse rounded-2xl bg-black/5" />
        </div>
        <div className="h-12 w-36 animate-pulse rounded-[0.95rem] bg-black/10" />
      </section>

      <section className="rounded-[1.5rem] border border-line bg-surface-strong shadow-[0_18px_38px_rgba(15,23,20,0.06)]">
        <div className="px-8 py-5">
          <div className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 animate-pulse rounded-full bg-black/10" />
              <div className="space-y-2">
                <div className="h-5 w-64 animate-pulse rounded-full bg-black/10" />
                <div className="h-4 w-32 animate-pulse rounded-full bg-black/5" />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="h-10 w-20 animate-pulse rounded-full bg-black/5" />
              <div className="h-8 w-8 animate-pulse rounded-full bg-black/5" />
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
    <div className="px-8 py-5">
      <div className="flex items-center justify-between gap-6">
        <div className="flex min-w-0 items-center gap-4">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-line bg-[#f7faff] text-[#8c9ab1]">
            <InviteIcon />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[1.26rem] font-semibold tracking-tight text-foreground">
              {invitation.email}
            </p>
            <p className="truncate text-[0.98rem] leading-6 text-[#95a3b9]">
              Invited {formatInvitationDate(invitation.createdAt)}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-4">
          <span className="inline-flex min-h-10 items-center justify-center rounded-full bg-[#ecfffd] px-4 text-sm font-semibold text-[#5dd8cf]">
            Pending
          </span>
          {isOwner ? (
            <button
              type="button"
              onClick={() => {
                void onRevoke(invitation);
              }}
              disabled={isRevoking}
              aria-label={`Cancel invitation for ${invitation.email}`}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#7f8ea5] transition-colors hover:bg-surface-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
            >
              <CloseIcon />
            </button>
          ) : null}
        </div>
      </div>

      {errorMessage ? (
        <p className="mt-3 pl-16 text-sm leading-6 text-danger">{errorMessage}</p>
      ) : null}
    </div>
  );
}

function InviteIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9">
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
