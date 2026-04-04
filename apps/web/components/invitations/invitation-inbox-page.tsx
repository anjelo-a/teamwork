'use client';

import { useEffect, useState } from 'react';
import type { UserInvitationInboxItem } from '@teamwork/types';
import { ApiError, acceptWorkspaceInvitation } from '@/lib/api/client';
import { ContentPanel } from '@/components/app-shell/page-state';
import { getButtonClassName } from '@/components/ui/button';

interface InvitationInboxPageProps {
  invitations: UserInvitationInboxItem[];
  accessToken: string | null;
  refreshSession: () => Promise<void>;
}

type RowState = Partial<Record<string, { isAccepting: boolean; errorMessage: string | null }>>;

export function InvitationInboxPage({
  invitations,
  accessToken,
  refreshSession,
}: InvitationInboxPageProps) {
  const [items, setItems] = useState(invitations);
  const [rowState, setRowState] = useState<RowState>({});
  const [successWorkspaceName, setSuccessWorkspaceName] = useState<string | null>(null);

  useEffect(() => {
    setItems(invitations);
  }, [invitations]);

  const handleAccept = async (item: UserInvitationInboxItem) => {
    if (!accessToken) {
      setRowState((current) => ({
        ...current,
        [item.invitation.id]: {
          isAccepting: false,
          errorMessage: 'Your session is unavailable. Refresh the page and try again.',
        },
      }));
      return;
    }

    setRowState((current) => ({
      ...current,
      [item.invitation.id]: {
        isAccepting: true,
        errorMessage: null,
      },
    }));

    try {
      await acceptWorkspaceInvitation(item.invitation.id, accessToken);
      setItems((current) =>
        current.filter((entry) => entry.invitation.id !== item.invitation.id),
      );
      setSuccessWorkspaceName(item.workspace.name);
      void refreshSession();
      setRowState((current) => {
        const { [item.invitation.id]: removed, ...remaining } = current;
        void removed;
        return remaining;
      });
    } catch (error) {
      setRowState((current) => ({
        ...current,
        [item.invitation.id]: {
          isAccepting: false,
          errorMessage:
            error instanceof ApiError || error instanceof Error
              ? error.message
              : 'Invitation could not be accepted.',
        },
      }));
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <section>
        <h2 className="text-[1.82rem] font-semibold tracking-tight text-foreground">
          Invitation Inbox
        </h2>
        <p className="mt-1.5 text-[0.98rem] leading-6 text-muted">
          Workspace invitations you&apos;ve received
        </p>
      </section>

      {successWorkspaceName ? (
        <section className="rounded-[calc(var(--radius-control)+0.22rem)] border border-line bg-[var(--color-info-soft)] px-5 py-4">
          <p className="text-[0.9rem] font-semibold text-foreground">
            Invitation accepted for {successWorkspaceName}
          </p>
          <p className="mt-1.5 text-[0.88rem] leading-6 text-muted">
            Your workspace access is being refreshed in the background.
          </p>
        </section>
      ) : null}

      <ContentPanel>
        {items.length === 0 ? (
          <div className="px-7 py-7">
            <p className="text-[1.05rem] font-semibold text-foreground">No invitations received</p>
            <p className="mt-2 text-[0.9rem] leading-6 text-muted">
              New workspace invitations will appear here when they are sent to your account.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-line">
            {items.map((item) => {
              const state = rowState[item.invitation.id];

              return (
                <InvitationInboxRow
                  key={item.invitation.id}
                  item={item}
                  isAccepting={state?.isAccepting ?? false}
                  errorMessage={state?.errorMessage ?? null}
                  onAccept={handleAccept}
                />
              );
            })}
          </div>
        )}
      </ContentPanel>
    </div>
  );
}

export function InvitationInboxPageSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <section>
        <div className="h-9 w-56 animate-pulse rounded-xl bg-black/10" />
        <div className="mt-2.5 h-5 w-72 animate-pulse rounded-xl bg-black/5" />
      </section>

      <section className="rounded-[1.5rem] border border-line bg-surface-strong shadow-[0_18px_38px_rgba(15,23,42,0.06)]">
        <div className="px-7 py-4.5">
          <div className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-3.5">
              <div className="h-11 w-11 animate-pulse rounded-full bg-black/10" />
              <div className="space-y-2">
                <div className="h-5 w-64 animate-pulse rounded-full bg-black/10" />
                <div className="h-4 w-32 animate-pulse rounded-full bg-black/5" />
              </div>
            </div>
            <div className="h-10 w-24 animate-pulse rounded-[0.85rem] bg-black/10" />
          </div>
        </div>
      </section>
    </div>
  );
}

function InvitationInboxRow({
  item,
  isAccepting,
  errorMessage,
  onAccept,
}: {
  item: UserInvitationInboxItem;
  isAccepting: boolean;
  errorMessage: string | null;
  onAccept: (item: UserInvitationInboxItem) => Promise<void>;
}) {
  return (
    <div className="px-7 py-4.5">
      <div className="flex items-center justify-between gap-6">
        <div className="flex min-w-0 items-center gap-3.5">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-accent">
            <InvitationIcon />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[1.14rem] font-semibold tracking-tight text-foreground">
              Invitation to join {item.workspace.name}
            </p>
            <p className="truncate text-[0.9rem] leading-6 text-muted">
              Invited {formatInvitationDate(item.invitation.createdAt)}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            void onAccept(item);
          }}
          disabled={isAccepting}
          className={`${getButtonClassName('success')} min-h-10 shrink-0 px-5 text-[0.95rem]`}
        >
          <AcceptIcon />
          {isAccepting ? 'Accepting...' : 'Accept'}
        </button>
      </div>

      {errorMessage ? (
        <p className="mt-2.5 pl-14 text-[0.88rem] leading-6 text-danger">{errorMessage}</p>
      ) : null}
    </div>
  );
}

function InvitationIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="M6 10a3 3 0 1 1 6 0" />
      <path d="M3.5 18c.8-2.5 3-4 5.5-4s4.7 1.5 5.5 4" />
      <path d="M14.5 11.5h6" />
      <path d="M17.5 8.5v6" />
    </svg>
  );
}

function AcceptIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="2.1">
      <path d="m5 12.5 4.2 4.2L19 7.5" />
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
