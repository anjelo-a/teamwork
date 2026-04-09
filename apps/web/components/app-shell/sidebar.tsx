'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { AuthenticatedWorkspace } from '@teamwork/types';
import {
  getSidebarNavigationItems,
  getWorkspaceScopedHref,
  matchesShellHref,
  type SidebarNavigationItem,
} from '@/lib/app-shell';
import { useAuthSession } from '@/lib/auth/auth-session-provider';
import { CreateWorkspaceModal } from '@/components/workspaces/create-workspace-modal';
import { DeleteWorkspaceDialog } from '@/components/workspaces/delete-workspace-dialog';

interface SidebarNavigationProps {
  currentPath: string;
  currentWorkspace: AuthenticatedWorkspace | null;
}

export function SidebarNavigation({
  currentPath,
  currentWorkspace,
}: SidebarNavigationProps) {
  const router = useRouter();
  const { auth, clearSession } = useAuthSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isCreateWorkspaceOpen, setIsCreateWorkspaceOpen] = useState(false);
  const [isDeleteWorkspaceOpen, setIsDeleteWorkspaceOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const selectedWorkspaceId = currentWorkspace?.id ?? auth.workspaces[0]?.id ?? null;
  const currentWorkspaceName = currentWorkspace?.name ?? auth.workspaces[0]?.name ?? 'Workspace';
  const currentWorkspaceRole =
    currentWorkspace?.membership.role ?? auth.workspaces[0]?.membership.role ?? null;
  const canDeleteWorkspace = selectedWorkspaceId !== null && currentWorkspaceRole === 'owner';
  const workspaceHeadingClassName = getWorkspaceHeadingClassName(currentWorkspaceName);
  const items = getSidebarNavigationItems(selectedWorkspaceId);
  const userName = auth.user.displayName.trim() || auth.user.email.trim() || 'User';
  const userEmail = auth.user.email.trim();
  const userInitials = useMemo(() => getInitials(userName, userEmail), [userEmail, userName]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!(event.target instanceof Node)) {
        return;
      }

      if (!menuRef.current?.contains(event.target)) {
        setMenuOpen(false);
      }
    }

    if (menuOpen) {
      window.addEventListener('mousedown', handlePointerDown);
    }

    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
    };
  }, [menuOpen]);

  return (
    <>
      <aside className="shell-panel hidden w-[238px] shrink-0 flex-col rounded-[1.45rem] border border-line bg-surface px-3.5 py-[1.125rem] shadow-[var(--shadow)] lg:flex">
        <div className="px-2">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted">TeamWork</p>
          <div className="mt-2.5 h-[3.5rem]">
            <h2
              title={currentWorkspaceName}
              className={`overflow-hidden font-semibold tracking-tight text-foreground ${workspaceHeadingClassName}`}
              style={{
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {currentWorkspaceName}
            </h2>
          </div>

          <div className="mt-4 rounded-[0.95rem] border border-line bg-surface-muted/70 p-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-muted">
                Workspace
              </p>
              <button
                type="button"
                onClick={() => {
                  setIsCreateWorkspaceOpen(true);
                }}
                className="rounded-[0.7rem] border border-line bg-surface-strong px-2.5 py-1 text-[0.76rem] font-semibold text-foreground transition-colors hover:border-accent/35 hover:bg-accent-soft/40"
              >
                New
              </button>
            </div>

            <label htmlFor="workspace-switcher" className="sr-only">
              Switch workspace
            </label>
            <select
              id="workspace-switcher"
              value={selectedWorkspaceId ?? ''}
              onChange={(event) => {
                const nextWorkspaceId = event.target.value;

                if (!nextWorkspaceId || nextWorkspaceId === selectedWorkspaceId) {
                  return;
                }

                router.push(getWorkspaceScopedHref(currentPath, nextWorkspaceId));
              }}
              className="mt-2 w-full rounded-[0.8rem] border border-line bg-surface-strong px-2.5 py-2 text-[0.85rem] font-semibold text-foreground outline-none transition-colors focus:border-accent"
            >
              {auth.workspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </option>
              ))}
            </select>

            {canDeleteWorkspace ? (
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setIsDeleteWorkspaceOpen(true);
                  }}
                  className="rounded-[0.7rem] border border-transparent px-2.5 py-1 text-[0.76rem] font-semibold text-danger transition-colors hover:border-danger/20 hover:bg-danger-soft"
                >
                  Delete
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <nav className="mt-6 flex flex-1 flex-col gap-1.5">
          {items.map((item) => (
            <SidebarLink
              key={item.href}
              item={item}
              isActive={matchesShellHref(item.href, currentPath)}
            />
          ))}
        </nav>

        <div ref={menuRef} className="relative mt-4 pt-4">
          <button
            type="button"
            onClick={() => {
              setMenuOpen((currentValue) => !currentValue);
            }}
            className="flex w-full items-center gap-3 rounded-[1rem] border border-line bg-surface-muted px-3 py-3 text-left transition-colors hover:border-accent/25 hover:bg-accent-soft/45"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold uppercase tracking-[0.08em] text-white">
              {userInitials}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[0.94rem] font-semibold text-foreground">
                {userName}
              </span>
              <span className="block truncate text-xs text-muted">
                {userEmail || 'TeamWork account'}
              </span>
            </span>
            <span
              className={`text-muted transition-transform ${menuOpen ? 'rotate-180' : ''}`}
              aria-hidden="true"
            >
              <ChevronDownIcon />
            </span>
          </button>

          {menuOpen ? (
            <div className="absolute inset-x-0 bottom-[calc(100%+0.55rem)] rounded-[1rem] border border-line bg-surface p-2 shadow-[var(--shadow)]">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  clearSession();
                  router.replace('/auth-required');
                }}
                className="flex w-full items-center gap-3 rounded-[0.85rem] px-3 py-2.5 text-left text-[0.92rem] font-semibold text-foreground transition-colors hover:bg-surface-muted"
              >
                <LogoutIcon />
                Log out
              </button>
            </div>
          ) : null}
        </div>
      </aside>

      <CreateWorkspaceModal
        open={isCreateWorkspaceOpen}
        onClose={() => {
          setIsCreateWorkspaceOpen(false);
        }}
        onCreated={(workspaceId) => {
          router.push(getWorkspaceScopedHref(currentPath, workspaceId));
        }}
      />
      {selectedWorkspaceId && isDeleteWorkspaceOpen ? (
        <DeleteWorkspaceDialog
          open
          workspaceId={selectedWorkspaceId}
          workspaceName={currentWorkspaceName}
          onClose={() => {
            setIsDeleteWorkspaceOpen(false);
          }}
        />
      ) : null}
    </>
  );
}

interface SidebarLinkProps {
  item: SidebarNavigationItem;
  isActive: boolean;
}

function SidebarLink({ item, isActive }: SidebarLinkProps) {
  return (
    <Link
      href={item.href}
      className={`group flex items-center gap-3 rounded-[0.95rem] px-3.5 py-3 transition-colors ${
        isActive
          ? 'bg-accent text-white shadow-sm'
          : 'text-foreground hover:bg-surface-muted'
      }`}
    >
      <span
        className={`flex h-[2.375rem] w-[2.375rem] items-center justify-center rounded-[0.82rem] transition-colors ${
          isActive ? 'bg-white/14 text-white' : 'bg-accent-soft text-accent-strong'
        }`}
      >
        {item.icon}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-[0.95rem] font-semibold leading-5">{item.label}</span>
        <span className={`text-xs ${isActive ? 'text-white/72' : 'text-muted'}`}>
          {item.description}
        </span>
      </span>
    </Link>
  );
}

function getInitials(displayName: string, email: string): string {
  const source = displayName.trim() || email.trim();

  if (!source) {
    return 'U';
  }

  const words = source
    .replace(/@.*/, '')
    .split(/[\s._-]+/)
    .filter(Boolean);

  if (words.length === 0) {
    return source.slice(0, 2).toUpperCase();
  }

  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');
}

function getWorkspaceHeadingClassName(workspaceName: string): string {
  const length = workspaceName.trim().length;

  if (length >= 50) {
    return 'text-[1.02rem] leading-[1.2rem]';
  }

  if (length >= 36) {
    return 'text-[1.14rem] leading-[1.32rem]';
  }

  if (length >= 24) {
    return 'text-[1.28rem] leading-[1.48rem]';
  }

  return 'text-[1.48rem] leading-[1.72rem]';
}

function ChevronDownIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M15 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3" />
      <path d="M10 17l5-5-5-5" />
      <path d="M15 12H4" />
    </svg>
  );
}
