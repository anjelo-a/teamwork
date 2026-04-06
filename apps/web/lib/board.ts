import type {
  TaskAssignmentFilter,
  TaskStatus,
  TaskSummary,
  UserSummary,
  WorkspaceMemberDetail,
} from '@teamwork/types';

export type BoardStatusFilter = 'all' | TaskStatus;

export type BoardAssigneeFilter =
  | {
      kind: 'all';
      label: 'All';
    }
  | {
      kind: 'unassigned';
      label: 'Unassigned';
    }
  | {
      kind: 'me';
      label: 'Me';
    }
  | {
      kind: 'member';
      label: string;
      userId: string;
    };

export interface BoardColumnDefinition {
  status: TaskStatus;
  title: string;
}

export interface GroupedBoardColumn extends BoardColumnDefinition {
  tasks: TaskSummary[];
}

export const BOARD_COLUMNS: readonly BoardColumnDefinition[] = [
  {
    status: 'todo',
    title: 'To Do',
  },
  {
    status: 'in_progress',
    title: 'In Progress',
  },
  {
    status: 'done',
    title: 'Done',
  },
] as const;

export const DEFAULT_BOARD_STATUS_FILTER: BoardStatusFilter = 'all';
export const DEFAULT_BOARD_ASSIGNEE_FILTER: BoardAssigneeFilter = {
  kind: 'all',
  label: 'All',
};

export function buildBoardAssigneeOptions(
  members: WorkspaceMemberDetail[] | null,
  currentUser: UserSummary,
): BoardAssigneeFilter[] {
  const baseOptions: BoardAssigneeFilter[] = [
    DEFAULT_BOARD_ASSIGNEE_FILTER,
    {
      kind: 'unassigned',
      label: 'Unassigned',
    },
    {
      kind: 'me',
      label: 'Me',
    },
  ];

  if (!members) {
    return baseOptions;
  }

  const memberOptions: BoardAssigneeFilter[] = members
    .filter((member) => member.user.id !== currentUser.id)
    .map((member) => ({
      kind: 'member' as const,
      label: member.user.displayName,
      userId: member.user.id,
    }))
    .sort((left, right) => left.label.localeCompare(right.label));

  return [...baseOptions, ...memberOptions];
}

export function getBoardAssigneeKey(option: BoardAssigneeFilter): string {
  if (option.kind === 'member') {
    return `member:${option.userId}`;
  }

  return option.kind;
}

export function resolveBoardAssigneeFilter(
  assigneeOptions: BoardAssigneeFilter[],
  assigneeFilter: BoardAssigneeFilter,
): BoardAssigneeFilter {
  const activeOption = assigneeOptions.find((option) => {
    if (option.kind !== assigneeFilter.kind) {
      return false;
    }

    if (option.kind === 'member' && assigneeFilter.kind === 'member') {
      return option.userId === assigneeFilter.userId;
    }

    return true;
  });

  return activeOption ?? DEFAULT_BOARD_ASSIGNEE_FILTER;
}

export function getBackendAssignmentFilter(
  assigneeFilter: BoardAssigneeFilter,
): TaskAssignmentFilter | undefined {
  if (assigneeFilter.kind === 'me') {
    return 'me';
  }

  if (assigneeFilter.kind === 'unassigned') {
    return 'unassigned';
  }

  return undefined;
}

export function matchesTaskAssignmentFilter(
  task: TaskSummary,
  assignmentFilter: TaskAssignmentFilter | undefined,
  currentUserId: string,
): boolean {
  if (!assignmentFilter || assignmentFilter === 'everyone') {
    return true;
  }

  if (assignmentFilter === 'me') {
    return task.assigneeUserId === currentUserId;
  }

  if (assignmentFilter === 'others') {
    return task.assigneeUserId !== null && task.assigneeUserId !== currentUserId;
  }

  return task.assigneeUserId === null;
}

export function filterBoardTasks(
  tasks: TaskSummary[],
  filters: {
    assigneeFilter: BoardAssigneeFilter;
    statusFilter: BoardStatusFilter;
    currentUserId: string;
  },
): TaskSummary[] {
  return tasks.filter((task) => {
    if (filters.statusFilter !== 'all' && task.status !== filters.statusFilter) {
      return false;
    }

    if (filters.assigneeFilter.kind === 'all') {
      return true;
    }

    if (filters.assigneeFilter.kind === 'unassigned') {
      return task.assigneeUserId === null;
    }

    if (filters.assigneeFilter.kind === 'me') {
      return task.assigneeUserId === filters.currentUserId;
    }

    return task.assigneeUserId === filters.assigneeFilter.userId;
  });
}

export function groupBoardTasks(tasks: TaskSummary[]): GroupedBoardColumn[] {
  return BOARD_COLUMNS.map((column) => ({
    ...column,
    tasks: tasks.filter((task) => task.status === column.status),
  }));
}
