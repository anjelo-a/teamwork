import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { TaskSummary, WorkspaceResponse } from '@teamwork/types';
import type { CalendarAudienceFilter, CalendarView } from '@/lib/calendar';
import { CalendarPage } from '@/components/calendar/calendar-page';

const WORKSPACE: WorkspaceResponse['workspace'] = {
  id: 'workspace-1',
  name: 'Product Team',
  slug: 'product-team',
  createdByUserId: 'user-owner',
  createdAt: '2026-04-10T00:00:00.000Z',
  updatedAt: '2026-04-10T00:00:00.000Z',
  memberCount: 3,
  invitationCount: 0,
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

function renderCalendarPage({
  tasks,
  currentView = 'month',
  currentFilter = 'for_everyone',
  selectedDate = '2026-04-15',
  onFilterChange = jest.fn(),
  onViewChange = jest.fn(),
  onPrevious = jest.fn(),
  onNext = jest.fn(),
  onToday = jest.fn(),
  onTaskOpen = jest.fn(),
  onShowMore = jest.fn(),
}: {
  tasks: TaskSummary[];
  currentView?: CalendarView;
  currentFilter?: CalendarAudienceFilter;
  selectedDate?: string;
  onFilterChange?: (value: CalendarAudienceFilter) => void;
  onViewChange?: (value: CalendarView) => void;
  onPrevious?: () => void;
  onNext?: () => void;
  onToday?: () => void;
  onTaskOpen?: (taskId: string) => void;
  onShowMore?: (date: string) => void;
}) {
  render(
    <CalendarPage
      workspace={WORKSPACE}
      tasks={tasks}
      currentUserId="user-owner"
      currentView={currentView}
      currentFilter={currentFilter}
      selectedDate={selectedDate}
      onFilterChange={onFilterChange}
      onViewChange={onViewChange}
      onPrevious={onPrevious}
      onNext={onNext}
      onToday={onToday}
      onTaskOpen={onTaskOpen}
      onShowMore={onShowMore}
    />,
  );

  return {
    onFilterChange,
    onViewChange,
    onPrevious,
    onNext,
    onToday,
    onTaskOpen,
    onShowMore,
  };
}

describe('CalendarPage', () => {
  it('shows an empty state when no task has a due date', () => {
    renderCalendarPage({
      tasks: [buildTask({ id: 'task-1', title: 'No due date task', dueDate: null })],
    });

    expect(
      screen.getByText('This workspace does not have any tasks with due dates yet.'),
    ).toBeInTheDocument();
  });

  it('supports month overflow with show-more actions', async () => {
    const user = userEvent.setup();
    const { onShowMore } = renderCalendarPage({
      tasks: [
        buildTask({
          id: 'task-1',
          title: 'Due task 1',
          dueDate: '2026-04-15',
          assigneeUserId: 'user-owner',
        }),
        buildTask({
          id: 'task-2',
          title: 'Due task 2',
          dueDate: '2026-04-15',
          assigneeUserId: 'user-owner',
        }),
        buildTask({
          id: 'task-3',
          title: 'Due task 3',
          dueDate: '2026-04-15',
          assigneeUserId: 'user-owner',
        }),
      ],
      currentView: 'month',
      currentFilter: 'for_me',
      selectedDate: '2026-04-15',
    });

    await user.click(screen.getByRole('button', { name: '+1 more' }));
    expect(onShowMore).toHaveBeenCalledWith('2026-04-15');
  });

  it('wires toolbar interactions for navigation and view changes', async () => {
    const user = userEvent.setup();
    const { onViewChange, onNext, onPrevious, onToday } = renderCalendarPage({
      tasks: [buildTask({ id: 'task-1', title: 'Due task', dueDate: '2026-04-15' })],
    });

    await user.click(screen.getByRole('button', { name: 'Week' }));
    await user.click(screen.getByRole('button', { name: 'Next period' }));
    await user.click(screen.getByRole('button', { name: 'Previous period' }));
    await user.click(screen.getByRole('button', { name: 'Today' }));

    expect(onViewChange).toHaveBeenCalledWith('week');
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onPrevious).toHaveBeenCalledTimes(1);
    expect(onToday).toHaveBeenCalledTimes(1);
  });
});
