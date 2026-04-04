import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'success';
type ButtonSize = 'default' | 'compact';

interface AppButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
}

export function AppButton({
  variant = 'primary',
  size = 'default',
  className,
  children,
  ...props
}: AppButtonProps) {
  return (
    <button
      {...props}
      className={joinClassNames(getButtonClassName(variant, size), className)}
    >
      {children}
    </button>
  );
}

export function getButtonClassName(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'default',
): string {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-[0.9rem] px-5 font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60';
  const sizeClass = size === 'compact' ? 'min-h-9 text-[0.92rem]' : 'min-h-10 text-[0.95rem]';

  const variantClass =
    variant === 'secondary'
      ? 'border border-line bg-surface-strong text-foreground hover:border-line-strong hover:bg-surface-muted'
      : variant === 'ghost'
        ? 'border border-transparent bg-transparent text-muted hover:border-line hover:bg-surface-muted hover:text-foreground'
        : variant === 'success'
          ? 'bg-[var(--color-success)] text-[#0f172a] shadow-[0_8px_18px_rgba(134,239,172,0.22)] hover:bg-[var(--color-success-strong)]'
          : 'bg-accent text-white shadow-[0_10px_22px_rgba(51,65,85,0.16)] hover:bg-accent-strong';

  return `${base} ${sizeClass} ${variantClass}`;
}

export function getIconButtonClassName(): string {
  return 'inline-flex h-9 w-9 items-center justify-center rounded-[0.8rem] border border-transparent bg-transparent text-muted transition-colors hover:border-line hover:bg-surface-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60';
}

function joinClassNames(...values: Array<string | undefined>): string {
  return values.filter(Boolean).join(' ');
}
