'use client';

import type { ReactNode } from 'react';

interface FieldProps {
  label: string;
  error?: string | undefined;
  hint?: string | undefined;
  required?: boolean;
  children: ReactNode;
}

export function Field({
  label,
  error,
  hint,
  required = false,
  children,
}: FieldProps) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-[0.96rem] font-semibold text-foreground">
        {label}
        {required ? <span className="ml-1 text-danger">*</span> : null}
      </span>
      {children}
      {error ? (
        <span className="text-[0.84rem] leading-5 text-danger">{error}</span>
      ) : hint ? (
        <span className="text-[0.84rem] leading-5 text-muted">{hint}</span>
      ) : null}
    </label>
  );
}

export function FormMessage({
  message,
  tone = 'danger',
}: {
  message: string;
  tone?: 'danger' | 'info';
}) {
  return (
    <div
      className={`rounded-[calc(var(--radius-control)+0.05rem)] border px-3.5 py-2.5 text-[0.88rem] leading-6 ${
        tone === 'info'
          ? 'border-line bg-[var(--color-info-soft)] text-foreground'
          : 'border-danger/20 bg-danger-soft text-danger'
      }`}
    >
      {message}
    </div>
  );
}

export function getTextControlClassName(hasError: boolean, tone: 'muted' | 'strong' = 'muted'): string {
  return `min-h-11 rounded-[0.85rem] border px-3.5 py-2.5 text-[0.95rem] text-foreground outline-none transition-colors placeholder:text-muted/70 ${
    tone === 'strong' ? 'bg-surface-strong' : 'bg-surface-strong'
  } ${hasError ? 'border-danger/55 focus:border-danger' : 'border-line focus:border-accent'}`;
}
