'use client';

import Link from 'next/link';
import type { ShellRouteContext } from '@/lib/app-shell';
import { useAppShellAction } from '@/lib/app-shell-action-context';

interface AppShellHeaderProps {
  routeContext: ShellRouteContext;
}

export function AppShellHeader({ routeContext }: AppShellHeaderProps) {
  const { actionOverride } = useAppShellAction();
  const action = actionOverride ?? routeContext.definition.action;

  return (
    <header className="flex items-start justify-between gap-6 border-b border-line px-6 py-5 lg:px-10">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted">
          {routeContext.definition.eyebrow}
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
          {routeContext.definition.title}
        </h1>
        {routeContext.definition.subtitle ? (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            {routeContext.definition.subtitle}
          </p>
        ) : null}
      </div>
      <div className="flex min-h-12 items-start justify-end">
        {action?.onAction ? (
          <button
            type="button"
            onClick={action.onAction}
            className="inline-flex min-h-12 items-center justify-center rounded-full bg-accent px-5 text-sm font-semibold text-white transition-colors hover:bg-accent-strong"
          >
            {action.label}
          </button>
        ) : action?.href ? (
          <Link
            href={action.href}
            className="inline-flex min-h-12 items-center justify-center rounded-full bg-accent px-5 text-sm font-semibold text-white transition-colors hover:bg-accent-strong"
          >
            {action.label}
          </Link>
        ) : action ? (
          <button
            type="button"
            disabled
            className="inline-flex min-h-12 cursor-not-allowed items-center justify-center rounded-full bg-accent px-5 text-sm font-semibold text-white/80 opacity-60"
          >
            {action.label}
          </button>
        ) : null}
      </div>
    </header>
  );
}
