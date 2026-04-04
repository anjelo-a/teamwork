'use client';

import { useEffect, useMemo, useState } from 'react';
import type {
  WorkspaceMemberDetail,
  WorkspaceRole,
} from '@teamwork/types';
import { ApiError, updateWorkspaceMemberRole } from '@/lib/api/client';

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
  const [memberItems, setMemberItems] = useState(members);
  const [rowState, setRowState] = useState<MemberRowState>({});
  const isOwner = currentUserRole === 'owner';

  useEffect(() => {
    setMemberItems(members);
  }, [members]);

  const sortedMembers = useMemo(
    () =>
      [...memberItems].sort((left, right) => {
        if (left.role !== right.role) {
          return left.role === 'owner' ? -1 : 1;
        }

        return left.user.displayName.localeCompare(right.user.displayName);
      }),
    [memberItems],
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

      setMemberItems((current) =>
        current.map((item) =>
          item.userId === member.userId ? response.membership : item,
        ),
      );
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
    <section className="rounded-[1.5rem] border border-line bg-surface-strong shadow-[0_18px_38px_rgba(15,23,20,0.06)]">
      <div className="border-b border-line px-8 py-7">
        <h2 className="text-[2rem] font-semibold tracking-tight text-foreground">Members</h2>
        <p className="mt-2 text-[1.1rem] leading-7 text-[#8a98af]">
          Manage workspace members and their roles
        </p>
      </div>

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
    </section>
  );
}

export function MembersPageSkeleton() {
  return (
    <section className="rounded-[1.5rem] border border-line bg-surface-strong shadow-[0_18px_38px_rgba(15,23,20,0.06)]">
      <div className="border-b border-line px-8 py-7">
        <div className="h-10 w-44 animate-pulse rounded-2xl bg-black/10" />
        <div className="mt-3 h-6 w-72 animate-pulse rounded-2xl bg-black/5" />
      </div>
      <div className="divide-y divide-line">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={String(index)} className="flex items-center justify-between gap-6 px-8 py-5">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 animate-pulse rounded-full bg-black/10" />
              <div className="space-y-2">
                <div className="h-5 w-40 animate-pulse rounded-full bg-black/10" />
                <div className="h-4 w-52 animate-pulse rounded-full bg-black/5" />
              </div>
            </div>
            <div className="h-12 w-28 animate-pulse rounded-[0.95rem] bg-black/5" />
          </div>
        ))}
      </div>
      <div className="rounded-b-[1.5rem] border-t border-line bg-[#e6faee] px-8 py-5">
        <div className="h-5 w-64 animate-pulse rounded-full bg-black/5" />
        <div className="mt-3 h-4 w-[30rem] max-w-full animate-pulse rounded-full bg-black/5" />
      </div>
    </section>
  );
}

function MemberRow({
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
    <div className="px-8 py-5">
      <div className="flex items-center justify-between gap-6">
        <div className="flex min-w-0 items-center gap-4">
          <MemberAvatar displayName={member.user.displayName} />
          <div className="min-w-0">
            <p className="truncate text-[1.32rem] font-semibold tracking-tight text-foreground">
              {member.user.displayName}
            </p>
            <p className="truncate text-[1rem] leading-6 text-[#95a3b9]">{member.user.email}</p>
          </div>
        </div>

        <div className="flex w-32 shrink-0 flex-col items-end gap-2">
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
        <p className="mt-3 pl-16 text-sm leading-6 text-danger">{errorMessage}</p>
      ) : null}
    </div>
  );
}

function MemberAvatar({ displayName }: { displayName: string }) {
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'M';

  return (
    <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#38465e] text-sm font-semibold text-white">
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
      <div className="inline-flex min-h-11 w-full items-center justify-center rounded-[0.95rem] border border-line bg-[#f7faff] px-4 text-sm font-semibold capitalize text-[#7e8da5]">
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
      className="min-h-11 w-full rounded-[0.95rem] border border-line bg-[#f7faff] px-4 text-sm font-semibold capitalize text-[#5f7088] outline-none transition-colors focus:border-accent disabled:cursor-not-allowed disabled:opacity-60"
    >
      <option value="owner">Owner</option>
      <option value="member">Member</option>
    </select>
  );
}

function OwnerNotice() {
  return (
    <div className="rounded-b-[1.5rem] border-t border-line bg-[#e6faee] px-8 py-5">
      <div className="flex items-start gap-3">
        <NoticeIcon />
        <div>
          <p className="text-base font-semibold text-foreground">At least one owner required</p>
          <p className="mt-1 text-[1rem] leading-7 text-[#7b8e88]">
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
      className="mt-0.5 h-5 w-5 shrink-0 text-[#5f6f88]"
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
