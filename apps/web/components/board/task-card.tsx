import type { TaskSummary } from '@teamwork/types';
import { readBoardStatusAccent } from '@/lib/board-status-accent';

interface BoardTaskCardProps {
  task: TaskSummary;
  onOpen: (taskId: string) => void;
}

export function BoardTaskCard({ task, onOpen }: BoardTaskCardProps) {
  const accentStyles = readBoardStatusAccent(task.status);

  return (
    <button
      type="button"
      onClick={() => {
        onOpen(task.id);
      }}
      className={`rounded-[0.875rem] border px-[1.25rem] py-[1.125rem] text-left transition-transform transition-colors hover:-translate-y-0.5 ${accentStyles.cardClassName}`}
    >
      <div className="flex items-start gap-[0.75rem]">
        <span className={`mt-[0.4rem] h-[0.75rem] w-[0.75rem] shrink-0 rounded-full ${accentStyles.dotClassName}`} />
        <div className="min-w-0 flex-1">
          <h4 className="text-[1rem] font-semibold leading-[1.35] tracking-tight text-foreground">
            {task.title}
          </h4>

          <div className="mt-[0.875rem] flex flex-wrap items-center justify-between gap-x-[1rem] gap-y-[0.25rem] text-[0.8125rem] font-medium text-muted">
            <TaskMeta label={task.assigneeUser?.displayName ?? 'Unassigned'} />
            <TaskMeta label={`By ${task.createdByUser.displayName}`} />
          </div>
        </div>
      </div>
    </button>
  );
}

function TaskMeta({ label }: { label: string }) {
  return <span className="font-medium">{label}</span>;
}
