'use client';

import {
  useEffect,
  useId,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { getIconButtonClassName } from '@/components/ui/button';

interface DialogProps {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  headerActions?: ReactNode;
  hideDefaultCloseButton?: boolean;
  panelClassName?: string;
  bodyClassName?: string;
}

export function Dialog({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  headerActions,
  hideDefaultCloseButton = false,
  panelClassName,
  bodyClassName,
}: DialogProps) {
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  const handleOverlayClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,20,0.18)] px-6 py-10 backdrop-blur-[2px]"
      onClick={handleOverlayClick}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={`w-full max-w-[628px] rounded-[1.1rem] border border-line/90 bg-surface-strong shadow-[0_18px_48px_rgba(15,23,20,0.12)] ${panelClassName ?? ''}`}
      >
        <div className="flex items-start justify-between gap-5 border-b border-line px-6 py-5">
          <div className="min-w-0">
            <h2 id={titleId} className="text-[1.45rem] font-semibold tracking-tight text-foreground">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="mt-1.5 text-[0.92rem] leading-6 text-muted">
                {description}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {headerActions}
            {hideDefaultCloseButton ? null : (
              <button
                type="button"
                onClick={onClose}
                className={getIconButtonClassName()}
                aria-label="Close dialog"
              >
                <CloseIcon />
              </button>
            )}
          </div>
        </div>

        <div className={bodyClassName ?? 'px-6 py-5'}>{children}</div>

        {footer ? (
          <div className="flex items-center justify-end gap-2.5 border-t border-line px-6 py-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
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
