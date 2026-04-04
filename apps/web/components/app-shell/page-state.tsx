import type { ReactNode } from 'react';
import { AppButton } from '@/components/ui/button';

type StatusTone = 'default' | 'warning' | 'danger';

interface PageStatusCardProps {
  title: string;
  description: string;
  tone: StatusTone;
  actionLabel?: string;
  onAction?: () => void;
}

const toneClasses: Record<StatusTone, string> = {
  default: 'border-line bg-surface-strong',
  warning: 'border-line bg-[var(--color-success-soft)]',
  danger: 'border-line-strong bg-danger-soft',
};

export function PageStatusCard({
  title,
  description,
  tone,
  actionLabel,
  onAction,
}: PageStatusCardProps) {
  return (
    <section
      className={`shell-panel rounded-[var(--radius-panel)] border px-[var(--section-padding-x)] py-[var(--section-padding-y)] shadow-[var(--shadow)] ${toneClasses[tone]}`}
    >
      <h2 className="text-[1.42rem] font-semibold tracking-tight text-foreground">{title}</h2>
      <p className="mt-2.5 max-w-2xl text-[0.94rem] leading-6 text-muted">{description}</p>
      {actionLabel && onAction ? (
        <AppButton
          onClick={onAction}
          className="mt-4"
        >
          {actionLabel}
        </AppButton>
      ) : null}
    </section>
  );
}

export function ContentPanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`overflow-hidden rounded-[var(--radius-panel)] border border-line bg-surface-strong shadow-[var(--panel-shadow)] ${className ?? ''}`}
    >
      {children}
    </section>
  );
}

export function ContentPanelHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line px-[var(--section-padding-x)] py-[var(--section-padding-y)]">
      <div className="min-w-0">
        <h2 className="text-[1.7rem] font-semibold tracking-tight text-foreground">{title}</h2>
        {description ? (
          <p className="mt-1.5 text-[0.95rem] leading-6 text-muted">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function StatusBadge({
  label,
  tone = 'default',
}: {
  label: string;
  tone?: 'default' | 'accent' | 'success' | 'progress';
}) {
  const toneClass =
    tone === 'accent'
      ? 'bg-accent text-white'
      : tone === 'success'
        ? 'bg-success-soft text-foreground'
        : tone === 'progress'
          ? 'bg-[var(--color-info-soft)] text-foreground'
          : 'bg-surface-muted text-muted';

  return (
    <span
      className={`inline-flex min-h-[1.625rem] items-center rounded-full px-2.5 text-[0.7rem] font-semibold tracking-[0.02em] ${toneClass}`}
    >
      {label}
    </span>
  );
}

interface PageSurfaceProps {
  eyebrow?: string;
  title?: string;
  description?: string;
  variant?: 'default' | 'skeleton';
  children?: ReactNode;
}

export function PageSurface({
  eyebrow,
  title,
  description,
  variant = 'default',
  children,
}: PageSurfaceProps) {
  if (variant === 'skeleton') {
    return (
      <section className="shell-panel rounded-[var(--radius-panel)] border border-line bg-surface-strong px-[var(--section-padding-x)] py-[calc(var(--section-padding-y)+0.15rem)] shadow-[var(--shadow)]">
        <div className="h-3 w-28 animate-pulse rounded-full bg-black/10" />
        <div className="mt-4 h-9 w-80 max-w-full animate-pulse rounded-[0.95rem] bg-black/10" />
        <div className="mt-3 h-4 w-full animate-pulse rounded-full bg-black/5" />
        <div className="mt-2.5 h-4 w-3/4 animate-pulse rounded-full bg-black/5" />
      </section>
    );
  }

  return (
    <section className="shell-panel rounded-[var(--radius-panel)] border border-line bg-surface-strong px-[var(--section-padding-x)] py-[calc(var(--section-padding-y)+0.15rem)] shadow-[var(--shadow)]">
      {eyebrow ? (
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted">{eyebrow}</p>
      ) : null}
      {title ? (
        <h2 className="mt-2.5 text-[1.72rem] font-semibold tracking-tight text-foreground">{title}</h2>
      ) : null}
      {description ? (
        <p className="mt-2 max-w-2xl text-[0.94rem] leading-6 text-muted">{description}</p>
      ) : null}
      {children ? <div className="mt-3.5">{children}</div> : null}
    </section>
  );
}
