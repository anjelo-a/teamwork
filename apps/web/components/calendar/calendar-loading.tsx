export function CalendarLoadingState() {
  return (
    <section className="overflow-hidden rounded-[1.75rem] border border-line bg-surface-strong shadow-[var(--shadow)]">
      <div className="flex items-center justify-between gap-6 border-b border-line px-6 py-4">
        <div className="h-11 w-32 animate-pulse rounded-[0.95rem] bg-black/10" />
        <div className="flex items-center gap-3">
          <div className="h-10 w-48 animate-pulse rounded-full bg-black/10" />
          <div className="h-10 w-32 animate-pulse rounded-full bg-black/10" />
        </div>
      </div>

      <div className="border-b border-line px-6 py-8">
        <div className="mx-auto h-10 w-56 animate-pulse rounded-2xl bg-black/10" />
      </div>

      <div className="grid grid-cols-7 border-b border-line bg-surface-muted/80">
        {Array.from({ length: 7 }, (_, index) => (
          <div key={String(index)} className="border-r border-line px-4 py-3 last:border-r-0">
            <div className="mx-auto h-4 w-10 animate-pulse rounded-full bg-black/8" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {Array.from({ length: 14 }, (_, index) => (
          <div
            key={String(index)}
            className="min-h-[145px] border-r border-b border-line px-3 py-3 last:border-r-0"
          >
            <div className="h-8 w-8 animate-pulse rounded-full bg-black/8" />
            <div className="mt-4 h-9 w-full animate-pulse rounded-[0.8rem] bg-black/8" />
            <div className="mt-2 h-9 w-4/5 animate-pulse rounded-[0.8rem] bg-black/6" />
          </div>
        ))}
      </div>
    </section>
  );
}
