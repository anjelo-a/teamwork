import type { TaskSummary } from '@teamwork/types';

interface BoardTaskCardProps {
  task: TaskSummary;
  onOpen: (taskId: string) => void;
}

export function BoardTaskCard({ task, onOpen }: BoardTaskCardProps) {
  return (
    <button
      type="button"
      onClick={() => {
        onOpen(task.id);
      }}
      className="rounded-[1.05rem] border border-[#dde4ef] bg-white px-4 py-4 text-left shadow-[0_10px_24px_rgba(15,23,20,0.04)] transition-transform transition-colors hover:-translate-y-0.5 hover:border-line-strong"
    >
      <h4 className="text-[1.02rem] font-semibold leading-7 tracking-tight text-foreground">
        {task.title}
      </h4>

      {task.description ? (
        <p className="mt-2 line-clamp-3 text-[0.97rem] leading-7 text-[#7a8aa2]">
          {task.description}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[0.92rem] text-[#8d9ab0]">
        <TaskMeta label={task.assigneeUser?.displayName ?? 'Unassigned'} />
        <TaskMeta label={`By ${task.createdByUser.displayName}`} />
      </div>
    </button>
  );
}

function TaskMeta({ label }: { label: string }) {
  return <span className="font-medium">{label}</span>;
}
