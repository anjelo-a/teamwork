import { GUARDS_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import type { RequestUser } from '../common/interfaces/request-user.interface';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import type { ListTaskFiltersDto } from './dto/list-task-filters.dto';
import { TasksInboxController } from './tasks-inbox.controller';

describe('TasksInboxController', () => {
  const user: RequestUser = {
    id: 'user-1',
    email: 'owner@example.com',
    displayName: 'Owner',
    createdAt: '2026-03-27T00:00:00.000Z',
    updatedAt: '2026-03-27T00:00:00.000Z',
  };

  let controller: TasksInboxController;
  let tasksService: {
    listTasksForUser: jest.Mock;
  };

  beforeEach(() => {
    tasksService = {
      listTasksForUser: jest.fn(),
    };

    controller = new TasksInboxController(tasksService as never);
  });

  it('is mounted on the root tasks route and protected by jwt auth only', () => {
    expect(Reflect.getMetadata(PATH_METADATA, TasksInboxController)).toBe('tasks');
    expect(Reflect.getMetadata(GUARDS_METADATA, TasksInboxController)).toEqual([JwtAuthGuard]);
  });

  it('lists the authenticated user inbox through the service and wraps the response', async () => {
    const filters: ListTaskFiltersDto = {
      workspaceId: '4a4c990e-8299-4c7a-a6b2-d6f9d3773a1a',
      dueBucket: 'today',
      assignment: 'me',
      referenceDate: '2026-04-02',
    };
    tasksService.listTasksForUser.mockResolvedValueOnce({
      tasks: [{ id: 'task-1' }],
      limit: 50,
      hasMore: false,
      nextCursor: null,
    });

    await expect(controller.listTasks(user, filters)).resolves.toEqual({
      tasks: [{ id: 'task-1' }],
      limit: 50,
      hasMore: false,
      nextCursor: null,
    });
    expect(tasksService.listTasksForUser).toHaveBeenCalledWith(user.id, filters);
  });
});
