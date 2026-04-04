import type { GroupedBoardColumn } from '@/lib/board';
import { BoardTaskCard } from '@/components/board/task-card';

interface BoardColumnProps {
  column: GroupedBoardColumn;
  hasAnyVisibleTasks: boolean;
  onTaskOpen: (taskId: string) => void;
}

export function BoardColumn({ column, hasAnyVisibleTasks, onTaskOpen }: BoardColumnProps) {
  return (
    <section className="flex min-w-[280px] flex-1 flex-col">
      <div className="flex items-center gap-3 px-1 pb-4">
        <h3 className="text-[1.55rem] font-semibold tracking-tight text-foreground">
          {column.title}
        </h3>
        <span className="inline-flex min-w-7 items-center justify-center rounded-full bg-surface-muted px-2 py-1 text-xs font-semibold text-muted">
          {String(column.tasks.length)}
        </span>
      </div>

      <div className="flex min-h-[420px] flex-col gap-4 rounded-[1.4rem] border border-line/70 bg-white/40 p-3">
        {column.tasks.map((task) => (
          <BoardTaskCard key={task.id} task={task} onOpen={onTaskOpen} />
        ))}

        {column.tasks.length === 0 ? (
          <div className="flex min-h-[148px] items-center justify-center rounded-[1.05rem] border border-dashed border-line bg-white/65 px-5 text-center text-sm leading-6 text-muted">
            {hasAnyVisibleTasks
              ? `No ${column.title.toLowerCase()} tasks right now.`
              : 'No tasks match the current filters.'}
          </div>
        ) : null}
      </div>
    </section>
  );
}
