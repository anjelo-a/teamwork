import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TaskStatus as PrismaTaskStatus } from '@prisma/client';
import type { UserSummary } from '@teamwork/types';
import { MembershipsService } from '../memberships/memberships.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { TasksService } from './tasks.service';

describe('TasksService', () => {
  const workspaceId = 'workspace-1';
  const otherWorkspaceId = 'workspace-2';
  const userId = 'user-1';
  const otherUserId = 'user-2';
  const taskId = 'task-1';

  type UserRecord = {
    id: string;
    email: string;
    displayName: string;
    createdAt: Date;
    updatedAt: Date;
  };

  type TaskRecord = {
    id: string;
    workspaceId: string;
    title: string;
    description: string | null;
    status: PrismaTaskStatus;
    createdByUserId: string;
    assigneeUserId: string | null;
    createdAt: Date;
    updatedAt: Date;
    createdByUser: UserRecord;
    assigneeUser: UserRecord | null;
  };

  let prisma: {
    task: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    workspaceMembership: {
      findUnique: jest.Mock;
    };
  };
  let membershipsService: {
    requireMembership: jest.Mock;
  };
  let usersService: {
    toSummary: jest.Mock;
  };
  let service: TasksService;

  beforeEach(async () => {
    const toUserSummary = (user: UserRecord): UserSummary => ({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    });

    prisma = {
      task: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      workspaceMembership: {
        findUnique: jest.fn(),
      },
    };
    membershipsService = {
      requireMembership: jest.fn(),
    };
    usersService = {
      toSummary: jest.fn((user: UserRecord): UserSummary => toUserSummary(user)),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: PrismaService, useValue: prisma },
        { provide: MembershipsService, useValue: membershipsService },
        { provide: UsersService, useValue: usersService },
      ],
    }).compile();

    service = moduleRef.get(TasksService);
  });

  it('creates a task with the authenticated user as creator', async () => {
    prisma.workspaceMembership.findUnique.mockResolvedValueOnce({ id: 'membership-2' });
    prisma.task.create.mockResolvedValueOnce(buildTaskRecord());

    const maliciousInput = {
      title: '  Build   API  ',
      description: '  Add task routes  ',
      assigneeUserId: otherUserId,
      createdByUserId: 'spoofed-user',
    };

    const result = await service.createTask(workspaceId, maliciousInput, userId);
    const [createTaskArgs] = prisma.task.create.mock.calls as [
      [
        {
          data: {
            workspaceId: string;
            title: string;
            description: string | null;
            createdByUserId: string;
            assigneeUserId: string | null;
          };
        },
      ],
    ];

    expect(membershipsService.requireMembership).toHaveBeenCalledWith(workspaceId, userId);
    expect(createTaskArgs[0].data).toMatchObject({
      workspaceId,
      title: 'Build API',
      description: 'Add task routes',
      createdByUserId: userId,
      assigneeUserId: otherUserId,
    });
    expect(result.createdByUserId).toBe(userId);
  });

  it('blocks non-members from creating tasks', async () => {
    membershipsService.requireMembership.mockRejectedValueOnce(new ForbiddenException());

    await expect(
      service.createTask(
        workspaceId,
        {
          title: 'Build API',
        },
        userId,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.task.create).not.toHaveBeenCalled();
  });

  it('lists tasks for a workspace with stable ordering', async () => {
    prisma.task.findMany.mockResolvedValueOnce([buildTaskRecord()]);

    const result = await service.listTasksForWorkspace(workspaceId, userId);

    expect(membershipsService.requireMembership).toHaveBeenCalledWith(workspaceId, userId);
    expect(prisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workspaceId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
    );
    expect(result).toHaveLength(1);
  });

  it('returns task details when the task belongs to the workspace', async () => {
    prisma.task.findFirst.mockResolvedValueOnce(buildTaskRecord());

    const result = await service.getTaskForWorkspace(workspaceId, taskId, userId);

    expect(result.id).toBe(taskId);
  });

  it('blocks assigning a user who is not a workspace member', async () => {
    prisma.workspaceMembership.findUnique.mockResolvedValueOnce(null);

    await expect(
      service.createTask(
        workspaceId,
        {
          title: 'Build API',
          assigneeUserId: otherUserId,
        },
        userId,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('fails safely when the task does not belong to the requested workspace', async () => {
    prisma.task.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.getTaskForWorkspace(otherWorkspaceId, taskId, userId),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updates task fields without changing creator tracking', async () => {
    prisma.task.findFirst.mockResolvedValueOnce(buildTaskRecord());
    prisma.task.update.mockResolvedValueOnce(
      buildTaskRecord({
        title: 'Updated title',
        description: null,
      }),
    );

    const result = await service.updateTask(
      workspaceId,
      taskId,
      {
        title: '  Updated   title ',
        description: '   ',
      },
      userId,
    );

    expect(prisma.task.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: taskId },
        data: {
          title: 'Updated title',
          description: null,
        },
      }),
    );
    expect(result.createdByUserId).toBe(userId);
  });

  it('rejects task updates when no updatable fields are provided', async () => {
    prisma.task.findFirst.mockResolvedValueOnce(buildTaskRecord());

    await expect(service.updateTask(workspaceId, taskId, {}, userId)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.task.update).not.toHaveBeenCalled();
  });

  it('fails safely when updating a task outside the requested workspace', async () => {
    prisma.task.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.updateTask(otherWorkspaceId, taskId, { title: 'Updated title' }, userId),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.task.update).not.toHaveBeenCalled();
  });
  it('deletes a task after workspace and task checks pass', async () => {
    prisma.task.findFirst.mockResolvedValueOnce(buildTaskRecord());
    prisma.task.delete.mockResolvedValueOnce({});

    await service.deleteTask(workspaceId, taskId, userId);

    expect(prisma.task.delete).toHaveBeenCalledWith({
      where: { id: taskId },
    });
  });

  it('fails safely when deleting a task outside the requested workspace', async () => {
    prisma.task.findFirst.mockResolvedValueOnce(null);

    await expect(service.deleteTask(otherWorkspaceId, taskId, userId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.task.delete).not.toHaveBeenCalled();
  });

  it('supports unassigning a task', async () => {
    prisma.task.findFirst.mockResolvedValueOnce(buildTaskRecord());
    prisma.task.update.mockResolvedValueOnce(
      buildTaskRecord({
        assigneeUserId: null,
        assigneeUser: null,
      }),
    );

    const result = await service.updateTaskAssignee(workspaceId, taskId, null, userId);

    expect(result.assigneeUserId).toBeNull();
    expect(prisma.task.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { assigneeUserId: null },
      }),
    );
  });

  it('updates task status with allowed values', async () => {
    prisma.task.findFirst.mockResolvedValueOnce(buildTaskRecord());
    prisma.task.update.mockResolvedValueOnce(
      buildTaskRecord({
        status: PrismaTaskStatus.done,
      }),
    );

    const result = await service.updateTaskStatus(workspaceId, taskId, 'done', userId);

    expect(result.status).toBe('done');
    expect(prisma.task.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: PrismaTaskStatus.done },
      }),
    );
  });

  it('propagates workspace membership failures for non-members', async () => {
    membershipsService.requireMembership.mockRejectedValueOnce(
      new ForbiddenException('You do not belong to this workspace.'),
    );

    await expect(service.listTasksForWorkspace(workspaceId, userId)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  function buildTaskRecord(overrides: Partial<TaskRecord> = {}): TaskRecord {
    const createdByUser = {
      id: userId,
      email: 'owner@example.com',
      displayName: 'Owner',
      createdAt: new Date('2026-03-27T00:00:00.000Z'),
      updatedAt: new Date('2026-03-27T00:00:00.000Z'),
    };
    const assigneeUser = {
      id: otherUserId,
      email: 'member@example.com',
      displayName: 'Member',
      createdAt: new Date('2026-03-27T00:00:00.000Z'),
      updatedAt: new Date('2026-03-27T00:00:00.000Z'),
    };

    return {
      id: taskId,
      workspaceId,
      title: 'Build API',
      description: 'Add task routes',
      status: PrismaTaskStatus.todo,
      createdByUserId: userId,
      assigneeUserId: otherUserId,
      createdAt: new Date('2026-03-27T00:00:00.000Z'),
      updatedAt: new Date('2026-03-27T00:00:00.000Z'),
      createdByUser,
      assigneeUser,
      ...overrides,
    };
  }
});
