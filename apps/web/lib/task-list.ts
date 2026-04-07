import type { TaskSummary } from '@teamwork/types';

export interface TaskListOverlay {
  tasks: TaskSummary[];
  removedTaskIds: string[];
}

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

export function mergeTaskListOverlay(
  baseTasks: TaskSummary[],
  overlay: TaskListOverlay,
): TaskSummary[] {
  const removedTaskIds = new Set(overlay.removedTaskIds);
  let mergedTasks = baseTasks.filter((task) => !removedTaskIds.has(task.id));

  for (const task of overlay.tasks) {
    mergedTasks = upsertTaskSummary(mergedTasks, task);
  }

  return mergedTasks;
}

export function applyTaskOverlayMutation(
  overlay: TaskListOverlay,
  task: TaskSummary,
  options?: { shouldInclude?: boolean },
): TaskListOverlay {
  const shouldInclude = options?.shouldInclude ?? true;

  if (!shouldInclude) {
    return {
      tasks: removeTaskSummary(overlay.tasks, task.id),
      removedTaskIds: overlay.removedTaskIds.includes(task.id)
        ? overlay.removedTaskIds
        : [...overlay.removedTaskIds, task.id],
    };
  }

  return {
    tasks: upsertTaskSummary(overlay.tasks, task),
    removedTaskIds: overlay.removedTaskIds.filter((taskId) => taskId !== task.id),
  };
}

export function applyTaskOverlayRemoval(
  overlay: TaskListOverlay,
  taskId: string,
): TaskListOverlay {
  return {
    tasks: removeTaskSummary(overlay.tasks, taskId),
    removedTaskIds: overlay.removedTaskIds.includes(taskId)
      ? overlay.removedTaskIds
      : [...overlay.removedTaskIds, taskId],
  };
}
