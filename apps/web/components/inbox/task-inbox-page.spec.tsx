import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AuthenticatedWorkspace, TaskSummary } from '@teamwork/types';
import { TaskInboxPage } from '@/components/inbox/task-inbox-page';

const WORKSPACES: AuthenticatedWorkspace[] = [
  {
    id: 'workspace-1',
    name: 'Alpha Workspace',
    slug: 'alpha-workspace',
    createdByUserId: 'user-owner',
    createdAt: '2026-04-10T00:00:00.000Z',
    updatedAt: '2026-04-10T00:00:00.000Z',
    membership: {
      id: 'membership-owner',
      workspaceId: 'workspace-1',
      userId: 'user-owner',
      role: 'owner',
      createdAt: '2026-04-10T00:00:00.000Z',
    },
  },
];

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

describe('TaskInboxPage', () => {
  it('renders empty-state copy when there are no visible tasks', () => {
    render(<TaskInboxPage tasks={[]} workspaces={WORKSPACES} onTaskOpen={jest.fn()} />);

    expect(screen.getByText('No tasks available')).toBeInTheDocument();
    expect(
      screen.getByText('Tasks assigned to your accessible workspaces will appear here.'),
    ).toBeInTheDocument();
  });

  it('sorts due-date tasks first and opens a task from the inbox', async () => {
    const user = userEvent.setup();
    const onTaskOpen = jest.fn();
    const tasks = [
      buildTask({
        id: 'task-later',
        title: 'Later Due',
        dueDate: '2026-04-20',
      }),
      buildTask({
        id: 'task-no-date',
        title: 'No Due Date',
        dueDate: null,
        updatedAt: '2026-04-12T00:00:00.000Z',
      }),
      buildTask({
        id: 'task-earlier',
        title: 'Earlier Due',
        dueDate: '2026-04-12',
      }),
    ];

    render(<TaskInboxPage tasks={tasks} workspaces={WORKSPACES} onTaskOpen={onTaskOpen} />);

    const taskHeadings = screen.getAllByRole('heading', { level: 3 });
    expect(taskHeadings.map((heading) => heading.textContent)).toEqual([
      'Earlier Due',
      'Later Due',
      'No Due Date',
    ]);

    await user.click(screen.getByRole('button', { name: /Earlier Due/i }));
    expect(onTaskOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 'task-earlier' }));
  });
});
