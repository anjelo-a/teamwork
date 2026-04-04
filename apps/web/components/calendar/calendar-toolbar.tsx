'use client';

import { useEffect, useRef, useState } from 'react';
import {
  CALENDAR_FILTER_OPTIONS,
  type CalendarAudienceFilter,
  type CalendarView,
} from '@/lib/calendar';

interface CalendarToolbarProps {
  currentFilter: CalendarAudienceFilter;
  currentView: CalendarView;
  onFilterChange: (value: CalendarAudienceFilter) => void;
  onViewChange: (value: CalendarView) => void;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
}

export function CalendarToolbar({
  currentFilter,
  currentView,
  onFilterChange,
  onViewChange,
  onPrevious,
  onNext,
  onToday,
}: CalendarToolbarProps) {
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const filterMenuRef = useRef<HTMLDivElement | null>(null);
  const currentFilterOption = readFilterOption(currentFilter);

  useEffect(() => {
    if (!isFilterMenuOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (event.target instanceof Node && !filterMenuRef.current?.contains(event.target)) {
        setIsFilterMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [isFilterMenuOpen]);

  return (
    <div className="flex items-center justify-between gap-6 border-b border-line px-6 py-4">
      <div ref={filterMenuRef} className="relative">
        <button
          type="button"
          onClick={() => {
            setIsFilterMenuOpen((current) => !current);
          }}
          className="inline-flex min-h-11 items-center gap-2 rounded-[0.95rem] border border-line bg-surface-strong px-4 text-sm font-semibold text-foreground transition-colors hover:border-line-strong"
        >
          {currentFilterOption.label}
          <ChevronDownIcon />
        </button>

        {isFilterMenuOpen ? (
          <div className="absolute left-0 top-[calc(100%+10px)] z-20 w-[320px] rounded-[1.25rem] border border-line bg-surface-strong p-3 shadow-[0_20px_48px_rgba(15,23,20,0.14)]">
            {CALENDAR_FILTER_OPTIONS.map((option) => {
              const isActive = option.value === currentFilter;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onFilterChange(option.value);
                    setIsFilterMenuOpen(false);
                  }}
                  className="flex w-full items-start justify-between gap-4 rounded-[1rem] px-3 py-3 text-left transition-colors hover:bg-surface-muted"
                >
                  <div className="min-w-0">
                    <p className="text-base font-semibold text-foreground">{option.label}</p>
                    <p className="mt-1 text-sm leading-6 text-muted">{option.description}</p>
                  </div>
                  <span className="pt-1 text-accent">{isActive ? <CheckIcon /> : null}</span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-4">
        <div className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-muted/80 p-1">
          {(['month', 'week', 'day'] as CalendarView[]).map((view) => {
            const isActive = currentView === view;

            return (
              <button
                key={view}
                type="button"
                onClick={() => {
                  onViewChange(view);
                }}
                className={`inline-flex min-h-10 items-center rounded-full px-4 text-sm font-semibold transition-colors ${
                  isActive
                    ? 'bg-foreground text-white shadow-[0_8px_20px_rgba(15,23,20,0.18)]'
                    : 'text-foreground hover:bg-white/70'
                }`}
              >
                {capitalizeLabel(view)}
              </button>
            );
          })}
        </div>

        <div className="h-8 w-px bg-line" />

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPrevious}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-transparent text-foreground transition-colors hover:border-line hover:bg-surface-muted"
            aria-label="Previous period"
          >
            <ArrowIcon direction="left" />
          </button>
          <button
            type="button"
            onClick={onToday}
            className="inline-flex min-h-10 items-center rounded-full px-4 text-sm font-semibold text-foreground transition-colors hover:bg-surface-muted"
          >
            Today
          </button>
          <button
            type="button"
            onClick={onNext}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-transparent text-foreground transition-colors hover:border-line hover:bg-surface-muted"
            aria-label="Next period"
          >
            <ArrowIcon direction="right" />
          </button>
        </div>
      </div>
    </div>
  );
}

function capitalizeLabel(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function readFilterOption(value: CalendarAudienceFilter) {
  return (
    CALENDAR_FILTER_OPTIONS.find((option) => option.value === value) ??
    CALENDAR_FILTER_OPTIONS[0] ?? {
      value: 'for_me' as const,
      label: 'For me',
      description: 'Tasks with due dates created by me or assigned to me.',
    }
  );
}

function ChevronDownIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="m5 7.5 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m4.5 10 3.3 3.4L15.5 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowIcon({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      {direction === 'left' ? (
        <path d="m12.5 4.5-5 5 5 5" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="m7.5 4.5 5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}
