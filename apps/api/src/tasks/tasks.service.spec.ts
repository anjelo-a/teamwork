import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TaskStatus as PrismaTaskStatus, type Prisma } from '@prisma/client';
import { MembershipsService } from '../memberships/memberships.service';
import { PrismaService } from '../prisma/prisma.service';
import { TasksService } from './tasks.service';

describe('TasksService', () => {
  const workspaceId = 'workspace-1';
  const otherWorkspaceId = 'workspace-2';
  const userId = 'user-1';
  const otherUserId = 'user-2';
  const taskId = 'task-1';

  type TaskActorRecord = {
    id: string;
    displayName: string;
  };

  type TaskRecord = {
    id: string;
    workspaceId: string;
    title: string;
    description: string | null;
    dueDate: Date | null;
    status: PrismaTaskStatus;
    createdByUserId: string;
    assigneeUserId: string | null;
    createdAt: Date;
    updatedAt: Date;
    createdByUser: TaskActorRecord;
    assigneeUser: TaskActorRecord | null;
  };

  let prisma: {
    task: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    user: {
      findMany: jest.Mock;
    };
    workspaceMembership: {
      findUnique: jest.Mock;
    };
  };
  let membershipsService: {
    requireMembership: jest.Mock;
  };
  let service: TasksService;

  beforeEach(async () => {
    prisma = {
      task: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      user: {
        findMany: jest.fn(),
      },
      workspaceMembership: {
        findUnique: jest.fn(),
      },
    };
    membershipsService = {
      requireMembership: jest.fn(),
    };
    const defaultUserRecords: TaskActorRecord[] = [
      {
        id: userId,
        displayName: 'Owner',
      },
      {
        id: otherUserId,
        displayName: 'Member',
      },
    ];
    prisma.user.findMany.mockImplementation((args?: { where?: { id?: { in?: string[] } } }) => {
      const ids = args?.where?.id?.in ?? [];
      return Promise.resolve(defaultUserRecords.filter((user) => ids.includes(user.id)));
    });

    const moduleRef = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: PrismaService, useValue: prisma },
        { provide: MembershipsService, useValue: membershipsService },
      ],
    }).compile();

    service = moduleRef.get(TasksService);
  });

  it('creates a task with the authenticated user as creator', async () => {
    prisma.workspaceMembership.findUnique.mockResolvedValueOnce({ id: 'membership-2' });
    prisma.task.create.mockResolvedValueOnce(
      buildTaskRecord({
        dueDate: new Date('2026-04-18T00:00:00.000Z'),
      }),
    );

    const maliciousInput = {
      title: '  Build   API  ',
      description: '  Add task routes  ',
      assigneeUserId: otherUserId,
      dueDate: '2026-04-18',
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
            dueDate: Date | null;
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
      dueDate: new Date('2026-04-18T00:00:00.000Z'),
      createdByUserId: userId,
      assigneeUserId: otherUserId,
    });
    expect(result.createdByUserId).toBe(userId);
    expect(result.dueDate).toBe('2026-04-18');
  });

  it('rejects invalid due dates before creating a task', async () => {
    await expect(
      service.createTask(
        workspaceId,
        {
          title: 'Build API',
          dueDate: '2026-02-29',
        },
        userId,
      ),
    ).rejects.toThrow('Due date must be a valid date in YYYY-MM-DD format.');

    expect(prisma.task.create).not.toHaveBeenCalled();
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

    const result = await service.listTasksForWorkspace({
      workspaceId,
      currentUserId: userId,
    });

    expect(membershipsService.requireMembership).not.toHaveBeenCalled();
    expect(prisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workspaceId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 51,
      }),
    );
    expect(result).toEqual({
      tasks: [expect.objectContaining({ id: taskId })],
      limit: 50,
      hasMore: false,
      nextCursor: null,
    });
  });

  it('lists tasks for the current user across accessible workspaces', async () => {
    prisma.task.findMany.mockResolvedValueOnce([buildTaskRecord()]);

    const result = await service.listTasksForUser(userId, {});

    expect(membershipsService.requireMembership).not.toHaveBeenCalled();
    expect(prisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          workspace: {
            memberships: {
              some: {
                userId,
              },
            },
          },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 51,
      }),
    );
    expect(result).toEqual({
      tasks: [expect.objectContaining({ id: taskId })],
      limit: 50,
      hasMore: false,
      nextCursor: null,
    });
  });

  it('exposes when a task list is truncated by the response limit', async () => {
    prisma.task.findMany.mockResolvedValueOnce(
      Array.from({ length: 51 }, (_, index) =>
        buildTaskRecord({
          id: `task-${index + 1}`,
          createdAt: new Date(`2026-04-${String((index % 28) + 1).padStart(2, '0')}T00:00:00.000Z`),
        }),
      ),
    );

    const result = await service.listTasksForWorkspace({
      workspaceId,
      currentUserId: userId,
    });

    expect(result.tasks).toHaveLength(50);
    expect(result.limit).toBe(50);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toBe('task-50');
  });

  it('supports caller-defined limit values for task listing', async () => {
    prisma.task.findMany.mockResolvedValueOnce(
      Array.from({ length: 26 }, (_, index) =>
        buildTaskRecord({
          id: `task-limit-${index + 1}`,
        }),
      ),
    );

    const result = await service.listTasksForWorkspace({
      workspaceId,
      currentUserId: userId,
      limit: 25,
    });

    expect(prisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 26,
      }),
    );
    expect(result.limit).toBe(25);
    expect(result.tasks).toHaveLength(25);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toBe('task-limit-25');
  });

  it('applies cursor pagination when a cursor is provided', async () => {
    prisma.task.findMany.mockResolvedValueOnce([buildTaskRecord()]);

    await service.listTasksForWorkspace({
      workspaceId,
      currentUserId: userId,
      cursor: taskId,
    });

    expect(prisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: { id: taskId },
        skip: 1,
      }),
    );
  });

  it('reuses workspace-scoped listing when the user inbox is filtered to one workspace', async () => {
    prisma.task.findMany.mockResolvedValueOnce([buildTaskRecord()]);

    await service.listTasksForUser(userId, {
      workspaceId,
      assignment: 'me',
      dueBucket: 'today',
      referenceDate: '2026-04-15',
    });

    expect(membershipsService.requireMembership).toHaveBeenCalledWith(workspaceId, userId);
    expect(getLastListTasksWhere()).toEqual({
      workspaceId,
      assigneeUserId: userId,
      dueDate: {
        equals: new Date('2026-04-15T00:00:00.000Z'),
      },
    });
  });

  it('blocks inbox filtering to a workspace the user does not belong to', async () => {
    membershipsService.requireMembership.mockRejectedValueOnce(
      new ForbiddenException('You do not belong to this workspace.'),
    );

    await expect(
      service.listTasksForUser(userId, {
        workspaceId,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.task.findMany).not.toHaveBeenCalled();
  });

  it('leaves assignee unconstrained when assignment is everyone', async () => {
    prisma.task.findMany.mockResolvedValueOnce([buildTaskRecord()]);

    await service.listTasksForWorkspace({
      workspaceId,
      currentUserId: userId,
      assignment: 'everyone',
    });

    expect(getLastListTasksWhere()).toEqual({
      workspaceId,
    });
  });

  it('filters task listing to the current user when assignment is me', async () => {
    prisma.task.findMany.mockResolvedValueOnce([buildTaskRecord()]);

    await service.listTasksForWorkspace({
      workspaceId,
      currentUserId: userId,
      assignment: 'me',
    });

    expect(getLastListTasksWhere()).toEqual({
      workspaceId,
      assigneeUserId: userId,
    });
  });

  it('filters task listing to tasks assigned to other users when assignment is others', async () => {
    prisma.task.findMany.mockResolvedValueOnce([buildTaskRecord()]);

    await service.listTasksForWorkspace({
      workspaceId,
      currentUserId: userId,
      assignment: 'others',
    });

    expect(getLastListTasksWhere()).toEqual({
      workspaceId,
      AND: [{ assigneeUserId: { not: null } }, { assigneeUserId: { not: userId } }],
    });
  });

  it('filters task listing to unassigned tasks when assignment is unassigned', async () => {
    prisma.task.findMany.mockResolvedValueOnce([buildTaskRecord()]);

    await service.listTasksForWorkspace({
      workspaceId,
      currentUserId: userId,
      assignment: 'unassigned',
    });

    expect(getLastListTasksWhere()).toEqual({
      workspaceId,
      assigneeUserId: null,
    });
  });

  it('filters past-due tasks using the reference date and excludes completed tasks', async () => {
    prisma.task.findMany.mockResolvedValueOnce([buildTaskRecord()]);

    await service.listTasksForWorkspace({
      workspaceId,
      currentUserId: userId,
      dueBucket: 'past_due',
      referenceDate: '2026-04-15',
    });

    expect(getLastListTasksWhere()).toEqual({
      workspaceId,
      dueDate: {
        lt: new Date('2026-04-15T00:00:00.000Z'),
      },
      status: {
        not: PrismaTaskStatus.done,
      },
    });
  });

  it('filters tasks due today using the reference date', async () => {
    prisma.task.findMany.mockResolvedValueOnce([buildTaskRecord()]);

    await service.listTasksForWorkspace({
      workspaceId,
      currentUserId: userId,
      dueBucket: 'today',
      referenceDate: '2026-04-15',
    });

    expect(getLastListTasksWhere()).toEqual({
      workspaceId,
      dueDate: {
        equals: new Date('2026-04-15T00:00:00.000Z'),
      },
    });
  });

  it('filters upcoming tasks using the reference date', async () => {
    prisma.task.findMany.mockResolvedValueOnce([buildTaskRecord()]);

    await service.listTasksForWorkspace({
      workspaceId,
      currentUserId: userId,
      dueBucket: 'upcoming',
      referenceDate: '2026-04-15',
    });

    expect(getLastListTasksWhere()).toEqual({
      workspaceId,
      dueDate: {
        gt: new Date('2026-04-15T00:00:00.000Z'),
      },
    });
  });

  it('filters tasks without due dates when due bucket is no_date', async () => {
    prisma.task.findMany.mockResolvedValueOnce([buildTaskRecord()]);

    await service.listTasksForWorkspace({
      workspaceId,
      currentUserId: userId,
      dueBucket: 'no_date',
      referenceDate: '2026-04-15',
    });

    expect(getLastListTasksWhere()).toEqual({
      workspaceId,
      dueDate: null,
    });
  });

  it('defaults referenceDate to the current UTC date for date-based filters', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-04-02T18:30:00.000Z'));
    prisma.task.findMany.mockResolvedValueOnce([buildTaskRecord()]);

    try {
      await service.listTasksForWorkspace({
        workspaceId,
        currentUserId: userId,
        dueBucket: 'today',
      });
    } finally {
      jest.useRealTimers();
    }

    expect(prisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          workspaceId,
          dueDate: {
            equals: new Date('2026-04-02T00:00:00.000Z'),
          },
        },
        take: 51,
      }),
    );
  });

  it('rejects an invalid referenceDate before querying tasks', async () => {
    await expect(
      service.listTasksForWorkspace({
        workspaceId,
        currentUserId: userId,
        dueBucket: 'today',
        referenceDate: '2026-02-29',
      }),
    ).rejects.toThrow('Reference date must be a valid date in YYYY-MM-DD format.');

    expect(prisma.task.findMany).not.toHaveBeenCalled();
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
        dueDate: new Date('2026-04-21T00:00:00.000Z'),
      }),
    );

    const result = await service.updateTask(
      workspaceId,
      taskId,
      {
        title: '  Updated   title ',
        description: '   ',
        dueDate: '2026-04-21',
      },
      userId,
    );

    expect(prisma.task.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: taskId },
        data: {
          title: 'Updated title',
          description: null,
          dueDate: new Date('2026-04-21T00:00:00.000Z'),
        },
      }),
    );
    expect(result.createdByUserId).toBe(userId);
    expect(result.dueDate).toBe('2026-04-21');
  });

  it('rejects task updates when no updatable fields are provided', async () => {
    prisma.task.findFirst.mockResolvedValueOnce(buildTaskRecord());

    await expect(service.updateTask(workspaceId, taskId, {}, userId)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.task.update).not.toHaveBeenCalled();
  });

  it('supports clearing a task due date', async () => {
    prisma.task.findFirst.mockResolvedValueOnce(
      buildTaskRecord({
        dueDate: new Date('2026-04-21T00:00:00.000Z'),
      }),
    );
    prisma.task.update.mockResolvedValueOnce(
      buildTaskRecord({
        dueDate: null,
      }),
    );

    const result = await service.updateTask(
      workspaceId,
      taskId,
      {
        dueDate: null,
      },
      userId,
    );

    expect(prisma.task.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          dueDate: null,
        },
      }),
    );
    expect(result.dueDate).toBeNull();
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

  it('fails safely when updating assignee for a task outside the workspace', async () => {
    prisma.task.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.updateTaskAssignee(otherWorkspaceId, taskId, otherUserId, userId),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.workspaceMembership.findUnique).not.toHaveBeenCalled();
    expect(prisma.task.update).not.toHaveBeenCalled();
  });

  it('updates task status with allowed values', async () => {
    prisma.task.findFirst.mockResolvedValueOnce(buildTaskRecord());
    prisma.task.update.mockResolvedValueOnce(
      buildTaskRecord({
        status: PrismaTaskStatus.done,
      }),
    );

    const result = await service.updateTaskStatus(workspaceId, taskId, 'done');

    expect(result.status).toBe('done');
    expect(prisma.task.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: PrismaTaskStatus.done },
      }),
    );
  });

  it('fails safely when updating status for a task outside the workspace', async () => {
    prisma.task.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.updateTaskStatus(otherWorkspaceId, taskId, 'done'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.task.update).not.toHaveBeenCalled();
  });

  it('does not perform redundant membership checks for workspace list queries', async () => {
    prisma.task.findMany.mockResolvedValueOnce([buildTaskRecord()]);

    await service.listTasksForWorkspace({
      workspaceId,
      currentUserId: userId,
    });

    expect(membershipsService.requireMembership).not.toHaveBeenCalled();
  });

  it('does not perform redundant membership checks when updating task status', async () => {
    prisma.task.findFirst.mockResolvedValueOnce(buildTaskRecord());
    prisma.task.update.mockResolvedValueOnce(
      buildTaskRecord({
        status: PrismaTaskStatus.done,
      }),
    );

    await service.updateTaskStatus(workspaceId, taskId, 'done');

    expect(membershipsService.requireMembership).not.toHaveBeenCalled();
  });

  it('blocks non-members from updating task assignee', async () => {
    membershipsService.requireMembership.mockRejectedValueOnce(
      new ForbiddenException('You do not belong to this workspace.'),
    );

    await expect(
      service.updateTaskAssignee(workspaceId, taskId, otherUserId, userId),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  function buildTaskRecord(overrides: Partial<TaskRecord> = {}): TaskRecord {
    const createdByUser = {
      id: userId,
      displayName: 'Owner',
    };
    const assigneeUser = {
      id: otherUserId,
      displayName: 'Member',
    };

    return {
      id: taskId,
      workspaceId,
      title: 'Build API',
      description: 'Add task routes',
      dueDate: null,
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

  function getLastListTasksWhere(): Prisma.TaskWhereInput {
    const calls = prisma.task.findMany.mock.calls as Array<
      [
        {
          where: Prisma.TaskWhereInput;
        },
      ]
    >;
    const lastCall = calls[calls.length - 1];

    if (!lastCall) {
      throw new Error('Expected task.findMany to be called.');
    }

    return lastCall[0].where;
  }
});
