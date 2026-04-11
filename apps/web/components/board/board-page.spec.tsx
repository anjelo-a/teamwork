import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { TaskSummary, WorkspaceResponse } from '@teamwork/types';
import type { BoardAssigneeFilter, BoardStatusFilter } from '@/lib/board';
import { BoardPage } from '@/components/board/board-page';

const WORKSPACE: WorkspaceResponse['workspace'] = {
  id: 'workspace-1',
  name: 'Product Team',
  slug: 'product-team',
  createdByUserId: 'user-owner',
  createdAt: '2026-04-10T00:00:00.000Z',
  updatedAt: '2026-04-10T00:00:00.000Z',
  memberCount: 3,
  invitationCount: 1,
  membership: {
    id: 'membership-owner',
    workspaceId: 'workspace-1',
    userId: 'user-owner',
    role: 'owner',
    createdAt: '2026-04-10T00:00:00.000Z',
  },
};

function buildTask(input: Partial<TaskSummary> & Pick<TaskSummary, 'id' | 'title'>): TaskSummary {
  return {
    id: input.id,
    workspaceId: input.workspaceId ?? 'workspace-1',
    title: input.title,
    description: input.description ?? null,
    dueDate: input.dueDate ?? null,
    status: input.status ?? 'todo',
    createdByUserId: input.createdByUserId ?? 'user-owner',
    assigneeUserId: input.assigneeUserId ?? null,
    createdAt: input.createdAt ?? '2026-04-10T00:00:00.000Z',
    updatedAt: input.updatedAt ?? '2026-04-10T00:00:00.000Z',
    createdByUser: input.createdByUser ?? {
      id: 'user-owner',
      displayName: 'Owner Person',
    },
    assigneeUser: input.assigneeUser ?? null,
  };
}

function renderBoardPage({
  tasks,
  assigneeFilter = { kind: 'all', label: 'All' },
  statusFilter = 'all',
  onStatusChange = jest.fn(),
  onAssigneeChange = jest.fn(),
}: {
  tasks: TaskSummary[];
  assigneeFilter?: BoardAssigneeFilter;
  statusFilter?: BoardStatusFilter;
  onStatusChange?: (value: BoardStatusFilter) => void;
  onAssigneeChange?: (value: BoardAssigneeFilter) => void;
}) {
  const assigneeOptions: BoardAssigneeFilter[] = [
    { kind: 'all', label: 'All' },
    { kind: 'unassigned', label: 'Unassigned' },
    { kind: 'me', label: 'Me' },
    { kind: 'member', label: 'Alex Member', userId: 'user-alex' },
  ];

  render(
    <BoardPage
      workspace={WORKSPACE}
      tasks={tasks}
      assigneeFilter={assigneeFilter}
      assigneeOptions={assigneeOptions}
      statusFilter={statusFilter}
      statusOptions={['all', 'todo', 'in_progress', 'done']}
      currentUserId="user-owner"
      membersUnavailable={false}
      onStatusChange={onStatusChange}
      onAssigneeChange={onAssigneeChange}
      onTaskOpen={jest.fn()}
    />,
  );

  return {
    onStatusChange,
    onAssigneeChange,
  };
}

describe('BoardPage', () => {
  it('applies status and assignee filters before rendering tasks', () => {
    renderBoardPage({
      statusFilter: 'todo',
      assigneeFilter: { kind: 'me', label: 'Me' },
      tasks: [
        buildTask({ id: 'task-1', title: 'My TODO task', status: 'todo', assigneeUserId: 'user-owner' }),
        buildTask({ id: 'task-2', title: 'Other TODO task', status: 'todo', assigneeUserId: 'user-alex' }),
        buildTask({ id: 'task-3', title: 'My done task', status: 'done', assigneeUserId: 'user-owner' }),
      ],
    });

    expect(screen.getByText('My TODO task')).toBeInTheDocument();
    expect(screen.queryByText('Other TODO task')).not.toBeInTheDocument();
    expect(screen.queryByText('My done task')).not.toBeInTheDocument();
  });

  it('surfaces filter interactions to parent handlers', async () => {
    const user = userEvent.setup();
    const { onStatusChange, onAssigneeChange } = renderBoardPage({
      tasks: [buildTask({ id: 'task-1', title: 'Task' })],
    });

    await user.click(screen.getByRole('button', { name: 'Done' }));
    await user.click(screen.getByRole('button', { name: 'Me' }));

    expect(onStatusChange).toHaveBeenCalledWith('done');
    expect(onAssigneeChange).toHaveBeenCalledWith({
      kind: 'me',
      label: 'Me',
    });
  });

  it('shows empty-filter guidance when no tasks are visible', () => {
    renderBoardPage({
      statusFilter: 'done',
      assigneeFilter: { kind: 'me', label: 'Me' },
      tasks: [buildTask({ id: 'task-1', title: 'Someone else task', assigneeUserId: 'user-alex' })],
    });

    expect(screen.getAllByText('No tasks match the current filters.')).toHaveLength(3);
  });
});
