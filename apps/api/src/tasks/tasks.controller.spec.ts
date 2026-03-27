import { GUARDS_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import type { RequestUser } from '../common/interfaces/request-user.interface';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { WorkspaceMemberGuard } from '../common/auth/workspace-member.guard';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskAssigneeDto } from './dto/update-task-assignee.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import { TasksController } from './tasks.controller';

describe('TasksController', () => {
  const user: RequestUser = {
    id: 'user-1',
    email: 'owner@example.com',
    displayName: 'Owner',
    createdAt: '2026-03-27T00:00:00.000Z',
    updatedAt: '2026-03-27T00:00:00.000Z',
  };
  const workspaceId = '4a4c990e-8299-4c7a-a6b2-d6f9d3773a1a';
  const taskId = 'b9f6927b-8010-4f38-93ce-b0a1580f4f9b';

  let controller: TasksController;
  let tasksService: {
    listTasksForWorkspace: jest.Mock;
    createTask: jest.Mock;
    getTaskForWorkspace: jest.Mock;
    updateTask: jest.Mock;
    deleteTask: jest.Mock;
    updateTaskStatus: jest.Mock;
    updateTaskAssignee: jest.Mock;
  };

  beforeEach(() => {
    tasksService = {
      listTasksForWorkspace: jest.fn(),
      createTask: jest.fn(),
      getTaskForWorkspace: jest.fn(),
      updateTask: jest.fn(),
      deleteTask: jest.fn(),
      updateTaskStatus: jest.fn(),
      updateTaskAssignee: jest.fn(),
    };

    controller = new TasksController(tasksService as never);
  });

  it('is mounted on the workspace task route and protected by auth plus membership guards', () => {
    expect(Reflect.getMetadata(PATH_METADATA, TasksController)).toBe(
      'workspaces/:workspaceId/tasks',
    );
    expect(Reflect.getMetadata(GUARDS_METADATA, TasksController)).toEqual([
      JwtAuthGuard,
      WorkspaceMemberGuard,
    ]);
  });

  it('lists tasks through the service and wraps the response', async () => {
    tasksService.listTasksForWorkspace.mockResolvedValueOnce([{ id: taskId }]);

    await expect(controller.listTasks(user, workspaceId)).resolves.toEqual({
      tasks: [{ id: taskId }],
    });
    expect(tasksService.listTasksForWorkspace).toHaveBeenCalledWith(workspaceId, user.id);
  });

  it('creates a task through the service and wraps the response', async () => {
    const dto: CreateTaskDto = {
      title: 'Build API',
      description: 'Add CRUD',
      assigneeUserId: null,
    };
    tasksService.createTask.mockResolvedValueOnce({ id: taskId });

    await expect(controller.createTask(user, workspaceId, dto)).resolves.toEqual({
      task: { id: taskId },
    });
    expect(tasksService.createTask).toHaveBeenCalledWith(workspaceId, dto, user.id);
  });

  it('gets a task through the service and wraps the response', async () => {
    tasksService.getTaskForWorkspace.mockResolvedValueOnce({ id: taskId });

    await expect(controller.getTask(user, workspaceId, taskId)).resolves.toEqual({
      task: { id: taskId },
    });
    expect(tasksService.getTaskForWorkspace).toHaveBeenCalledWith(workspaceId, taskId, user.id);
  });

  it('updates a task through the service and wraps the response', async () => {
    const dto: UpdateTaskDto = { title: 'Updated task' };
    tasksService.updateTask.mockResolvedValueOnce({ id: taskId });

    await expect(controller.updateTask(user, workspaceId, taskId, dto)).resolves.toEqual({
      task: { id: taskId },
    });
    expect(tasksService.updateTask).toHaveBeenCalledWith(workspaceId, taskId, dto, user.id);
  });

  it('deletes a task through the service and returns success', async () => {
    tasksService.deleteTask.mockResolvedValueOnce(undefined);

    await expect(controller.deleteTask(user, workspaceId, taskId)).resolves.toEqual({
      success: true,
    });
    expect(tasksService.deleteTask).toHaveBeenCalledWith(workspaceId, taskId, user.id);
  });

  it('updates task status through the service and wraps the response', async () => {
    const dto: UpdateTaskStatusDto = { status: 'done' };
    tasksService.updateTaskStatus.mockResolvedValueOnce({ id: taskId });

    await expect(controller.updateTaskStatus(user, workspaceId, taskId, dto)).resolves.toEqual({
      task: { id: taskId },
    });
    expect(tasksService.updateTaskStatus).toHaveBeenCalledWith(
      workspaceId,
      taskId,
      dto.status,
      user.id,
    );
  });

  it('updates task assignee through the service and wraps the response', async () => {
    const dto: UpdateTaskAssigneeDto = { assigneeUserId: null };
    tasksService.updateTaskAssignee.mockResolvedValueOnce({ id: taskId });

    await expect(controller.updateTaskAssignee(user, workspaceId, taskId, dto)).resolves.toEqual({
      task: { id: taskId },
    });
    expect(tasksService.updateTaskAssignee).toHaveBeenCalledWith(
      workspaceId,
      taskId,
      dto.assigneeUserId,
      user.id,
    );
  });
});
