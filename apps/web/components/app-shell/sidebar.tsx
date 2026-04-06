'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { AuthenticatedWorkspace } from '@teamwork/types';
import {
  getSidebarNavigationItems,
  matchesShellHref,
  type SidebarNavigationItem,
} from '@/lib/app-shell';
import { useAuthSession } from '@/lib/auth/auth-session-provider';

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
  const menuRef = useRef<HTMLDivElement | null>(null);
  const items = getSidebarNavigationItems(currentWorkspace?.id ?? null);
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
    <aside className="shell-panel hidden w-[238px] shrink-0 flex-col rounded-[1.45rem] border border-line bg-surface px-3.5 py-[1.125rem] shadow-[var(--shadow)] lg:flex">
      <div className="px-2">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted">TeamWork</p>
        <h2 className="mt-2.5 text-[1.48rem] font-semibold tracking-tight text-foreground">
          {currentWorkspace?.name ?? 'Workspace'}
        </h2>
        <p className="mt-2.5 text-[0.92rem] leading-6 text-muted">
          Shared navigation and page framing for the authenticated app.
        </p>
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
