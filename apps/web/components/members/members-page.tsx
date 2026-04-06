'use client';

import { memo, useMemo, useState } from 'react';
import type {
  WorkspaceMemberDetail,
  WorkspaceRole,
} from '@teamwork/types';
import { ApiError, updateWorkspaceMemberRole } from '@/lib/api/client';
import { ContentPanel, ContentPanelHeader } from '@/components/app-shell/page-state';
import { getTextControlClassName } from '@/components/ui/form-controls';

interface MembersPageProps {
  workspaceId: string;
  members: WorkspaceMemberDetail[];
  currentUserRole: WorkspaceRole | null;
  accessToken: string | null;
}

type MemberRowState = Partial<
  Record<string, { isSaving: boolean; errorMessage: string | null }>
>;

export function MembersPage({
  workspaceId,
  members,
  currentUserRole,
  accessToken,
}: MembersPageProps) {
  const [memberOverrides, setMemberOverrides] = useState<Partial<Record<string, WorkspaceMemberDetail>>>({});
  const [rowState, setRowState] = useState<MemberRowState>({});
  const isOwner = currentUserRole === 'owner';

  const resolvedMembers = useMemo(
    () =>
      members.map((member) => memberOverrides[member.userId] ?? member),
    [memberOverrides, members],
  );

  const sortedMembers = useMemo(
    () =>
      [...resolvedMembers].sort((left, right) => {
        if (left.role !== right.role) {
          return left.role === 'owner' ? -1 : 1;
        }

        return left.user.displayName.localeCompare(right.user.displayName);
      }),
    [resolvedMembers],
  );

  const handleRoleChange = async (
    member: WorkspaceMemberDetail,
    nextRole: WorkspaceRole,
  ) => {
    if (!accessToken || !isOwner || nextRole === member.role) {
      return;
    }

    setRowState((current) => ({
      ...current,
      [member.userId]: {
        isSaving: true,
        errorMessage: null,
      },
    }));

    try {
      const response = await updateWorkspaceMemberRole(
        workspaceId,
        member.userId,
        accessToken,
        nextRole,
      );

      setMemberOverrides((current) => ({
        ...current,
        [member.userId]: response.membership,
      }));
      setRowState((current) => ({
        ...current,
        [member.userId]: {
          isSaving: false,
          errorMessage: null,
        },
      }));
    } catch (error) {
      setRowState((current) => ({
        ...current,
        [member.userId]: {
          isSaving: false,
          errorMessage:
            error instanceof ApiError || error instanceof Error
              ? error.message
              : 'Role could not be updated.',
        },
      }));
    }
  };

  return (
    <ContentPanel>
      <ContentPanelHeader
        title="Members"
        description="Manage workspace members and their roles"
      />

      <div className="divide-y divide-line">
        {sortedMembers.map((member) => {
          const state = rowState[member.userId];

          return (
            <MemberRow
              key={member.id}
              member={member}
              isEditable={isOwner}
              isSaving={state?.isSaving ?? false}
              errorMessage={state?.errorMessage ?? null}
              onRoleChange={handleRoleChange}
            />
          );
        })}
      </div>

      <OwnerNotice />
    </ContentPanel>
  );
}

export function MembersPageSkeleton() {
  return (
    <ContentPanel>
      <div className="border-b border-line px-7 py-6">
        <div className="h-9 w-40 animate-pulse rounded-xl bg-black/10" />
        <div className="mt-2.5 h-5 w-64 animate-pulse rounded-xl bg-black/5" />
      </div>
      <div className="divide-y divide-line">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={String(index)} className="flex items-center justify-between gap-6 px-7 py-4.5">
            <div className="flex items-center gap-3.5">
              <div className="h-11 w-11 animate-pulse rounded-full bg-black/10" />
              <div className="space-y-2">
                <div className="h-5 w-36 animate-pulse rounded-full bg-black/10" />
                <div className="h-4 w-52 animate-pulse rounded-full bg-black/5" />
              </div>
            </div>
            <div className="h-11 w-26 animate-pulse rounded-[0.85rem] bg-black/5" />
          </div>
        ))}
      </div>
      <div className="rounded-b-[1.25rem] border-t border-line bg-success-soft px-7 py-4.5">
        <div className="h-5 w-60 animate-pulse rounded-full bg-black/5" />
        <div className="mt-2.5 h-4 w-[28rem] max-w-full animate-pulse rounded-full bg-black/5" />
      </div>
    </ContentPanel>
  );
}

const MemberRow = memo(function MemberRow({
  member,
  isEditable,
  isSaving,
  errorMessage,
  onRoleChange,
}: {
  member: WorkspaceMemberDetail;
  isEditable: boolean;
  isSaving: boolean;
  errorMessage: string | null;
  onRoleChange: (
    member: WorkspaceMemberDetail,
    nextRole: WorkspaceRole,
  ) => Promise<void>;
}) {
  return (
    <div className="px-7 py-4.5">
      <div className="flex items-center justify-between gap-6">
        <div className="flex min-w-0 items-center gap-3.5">
          <MemberAvatar displayName={member.user.displayName} />
          <div className="min-w-0">
            <p className="truncate text-[1.18rem] font-semibold tracking-tight text-foreground">
              {member.user.displayName}
            </p>
            <p className="truncate text-[0.93rem] leading-6 text-muted">{member.user.email}</p>
          </div>
        </div>

        <div className="flex w-[118px] shrink-0 flex-col items-end gap-2">
          <RoleControl
            value={member.role}
            isEditable={isEditable}
            isSaving={isSaving}
            onChange={(nextRole) => {
              void onRoleChange(member, nextRole);
            }}
          />
        </div>
      </div>

      {errorMessage ? (
        <p className="mt-2.5 pl-14 text-[0.88rem] leading-6 text-danger">{errorMessage}</p>
      ) : null}
    </div>
  );
});

function MemberAvatar({ displayName }: { displayName: string }) {
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'M';

  return (
    <div className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-accent text-[0.88rem] font-semibold text-white">
      {initials}
    </div>
  );
}

function RoleControl({
  value,
  isEditable,
  isSaving,
  onChange,
}: {
  value: WorkspaceRole;
  isEditable: boolean;
  isSaving: boolean;
  onChange: (nextRole: WorkspaceRole) => void;
}) {
  if (!isEditable) {
    return (
      <div className="inline-flex min-h-10 w-full items-center justify-center rounded-[0.85rem] border border-line bg-surface-muted px-3.5 text-[0.9rem] font-semibold capitalize text-muted">
        {value}
      </div>
    );
  }

  return (
    <select
      value={value}
      disabled={isSaving}
      onChange={(event) => {
        const nextRole = readWorkspaceRole(event.target.value);

        if (nextRole) {
          onChange(nextRole);
        }
      }}
      className={`${getTextControlClassName(false)} min-h-10 w-full px-3.5 py-2 text-[0.9rem] font-semibold capitalize text-foreground disabled:cursor-not-allowed disabled:opacity-60`}
    >
      <option value="owner">Owner</option>
      <option value="member">Member</option>
    </select>
  );
}

function OwnerNotice() {
  return (
    <div className="rounded-b-[1.25rem] border-t border-line bg-success-soft px-7 py-4.5">
      <div className="flex items-start gap-2.5">
        <NoticeIcon />
        <div>
          <p className="text-[0.98rem] font-semibold text-foreground">At least one owner required</p>
          <p className="mt-1 text-[0.92rem] leading-6 text-muted">
            You cannot change the last owner&apos;s role. Promote another member to owner first.
          </p>
        </div>
      </div>
    </div>
  );
}

function NoticeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="mt-0.5 h-4.5 w-4.5 shrink-0 text-accent"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
    >
      <path d="M12 4.5 4.5 18h15z" />
      <path d="M12 9v4.5" />
      <circle cx="12" cy="16.5" r=".8" fill="currentColor" stroke="none" />
    </svg>
  );
}

function readWorkspaceRole(value: string): WorkspaceRole | null {
  if (value === 'owner' || value === 'member') {
    return value;
  }

  return null;
}
