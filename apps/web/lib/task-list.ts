import type { TaskSummary } from '@teamwork/types';

export function upsertTaskSummary(
  tasks: TaskSummary[],
  nextTask: TaskSummary,
  options?: { shouldInclude?: boolean },
): TaskSummary[] {
  const shouldInclude = options?.shouldInclude ?? true;
  const existingIndex = tasks.findIndex((task) => task.id === nextTask.id);

  if (!shouldInclude) {
    if (existingIndex === -1) {
      return tasks;
    }

    return tasks.filter((task) => task.id !== nextTask.id);
  }

  if (existingIndex === -1) {
    return [nextTask, ...tasks];
  }

  return tasks.map((task) => (task.id === nextTask.id ? nextTask : task));
}

export function removeTaskSummary(tasks: TaskSummary[], taskId: string): TaskSummary[] {
  return tasks.filter((task) => task.id !== taskId);
}
