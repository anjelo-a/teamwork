import { Test } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { WorkspacesService } from './workspaces.service';
import type { WorkspaceMembershipSummary } from '@teamwork/types';
import { WorkspacePolicyService } from '../common/policy/workspace-policy.service';
import { SecurityTelemetryService } from '../common/security/security-telemetry.service';
import { MembershipsService } from '../memberships/memberships.service';
import { PrismaService } from '../prisma/prisma.service';
import { TasksService } from '../tasks/tasks.service';

describe('WorkspacesService', () => {
  type WorkspaceMembershipRecord = {
    id: string;
    workspaceId: string;
    userId: string;
    role: 'owner' | 'member';
    createdAt: Date;
  };

  let prisma: {
    workspace: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    workspaceMembership: {
      findUniqueOrThrow: jest.Mock;
      findUnique: jest.Mock;
      count: jest.Mock;
      update: jest.Mock;
    };
    workspaceInvitation: {
      count: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let membershipsService: {
    createMembership: jest.Mock;
    requireMembership: jest.Mock;
    listWorkspaceMembers: jest.Mock;
    toSummary: jest.Mock;
    toDetail: jest.Mock;
  };
  let tasksService: {
    listTasksForWorkspace: jest.Mock;
  };
  let securityTelemetryService: {
    record: jest.Mock;
  };
  let service: WorkspacesService;

  beforeEach(async () => {
    const runInTransaction = <T>(callback: (tx: typeof prisma) => Promise<T>): Promise<T> =>
      callback(prisma);
    const toMembershipSummary = (
      membership: WorkspaceMembershipRecord,
    ): WorkspaceMembershipSummary => ({
      id: membership.id,
      workspaceId: membership.workspaceId,
      userId: membership.userId,
      role: membership.role,
      createdAt: membership.createdAt.toISOString(),
    });

    prisma = {
      workspace: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      workspaceMembership: {
        findUniqueOrThrow: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
      workspaceInvitation: {
        count: jest.fn(),
      },
      $transaction: jest.fn(runInTransaction),
    };
    membershipsService = {
      createMembership: jest.fn(),
      requireMembership: jest.fn(),
      listWorkspaceMembers: jest.fn(),
      toSummary: jest.fn(
        (membership: WorkspaceMembershipRecord): WorkspaceMembershipSummary =>
          toMembershipSummary(membership),
      ),
      toDetail: jest.fn((membership, user) => ({
        ...toMembershipSummary(membership),
        user: {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString(),
        },
      })),
    };
    tasksService = {
      listTasksForWorkspace: jest.fn(),
    };
    securityTelemetryService = {
      record: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        WorkspacesService,
        { provide: PrismaService, useValue: prisma },
        { provide: MembershipsService, useValue: membershipsService },
        { provide: TasksService, useValue: tasksService },
        WorkspacePolicyService,
        { provide: SecurityTelemetryService, useValue: securityTelemetryService },
      ],
    }).compile();

    service = moduleRef.get(WorkspacesService);
  });

  it('creates a workspace and owner membership in one transaction', async () => {
    prisma.workspace.findUnique.mockResolvedValueOnce(null);
    prisma.workspace.create.mockResolvedValueOnce({
      id: 'workspace-1',
      name: 'Product Team',
      slug: 'product-team',
      createdByUserId: 'user-1',
      createdAt: new Date('2026-03-26T00:00:00.000Z'),
      updatedAt: new Date('2026-03-26T00:00:00.000Z'),
    });
    prisma.workspaceMembership.findUniqueOrThrow.mockResolvedValueOnce({
      id: 'membership-1',
      workspaceId: 'workspace-1',
      userId: 'user-1',
      role: 'owner',
      createdAt: new Date('2026-03-26T00:00:00.000Z'),
    });

    const result = await service.createWorkspaceForUser('Product Team', 'user-1');

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(membershipsService.createMembership).toHaveBeenCalledWith(
      {
        workspaceId: 'workspace-1',
        userId: 'user-1',
        role: 'owner',
      },
      prisma,
    );
    expect(result.memberCount).toBe(1);
    expect(result.invitationCount).toBe(0);
  });

  it('retries workspace creation when slug creation races on a unique constraint', async () => {
    prisma.workspace.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    prisma.workspace.create.mockResolvedValueOnce({
      id: 'workspace-1',
      name: 'Product Team',
      slug: 'product-team',
      createdByUserId: 'user-1',
      createdAt: new Date('2026-03-26T00:00:00.000Z'),
      updatedAt: new Date('2026-03-26T00:00:00.000Z'),
    });
    prisma.workspaceMembership.findUniqueOrThrow.mockResolvedValueOnce({
      id: 'membership-1',
      workspaceId: 'workspace-1',
      userId: 'user-1',
      role: 'owner',
      createdAt: new Date('2026-03-26T00:00:00.000Z'),
    });
    prisma.$transaction
      .mockRejectedValueOnce({ code: 'P2002', meta: { target: ['slug'] } })
      .mockImplementationOnce(async (callback: (tx: typeof prisma) => Promise<unknown>) =>
        callback(prisma),
      );

    const result = await service.createWorkspaceForUser('Product Team', 'user-1');

    expect(result.slug).toBe('product-team');
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });

  it('returns workspace details with member and invitation counts', async () => {
    prisma.workspaceMembership.findUnique.mockResolvedValueOnce({
      id: 'membership-1',
      workspaceId: 'workspace-1',
      userId: 'user-1',
      role: 'owner',
      createdAt: new Date('2026-03-26T00:00:00.000Z'),
      workspace: {
        id: 'workspace-1',
        name: 'Product Team',
        slug: 'product-team',
        createdByUserId: 'user-1',
        createdAt: new Date('2026-03-26T00:00:00.000Z'),
        updatedAt: new Date('2026-03-26T00:00:00.000Z'),
      },
    });
    prisma.workspaceMembership.count.mockResolvedValueOnce(3);
    prisma.workspaceInvitation.count.mockResolvedValueOnce(2);

    const result = await service.getWorkspaceForUser('workspace-1', 'user-1');

    expect(result.memberCount).toBe(3);
    expect(result.invitationCount).toBe(2);
  });

  it('returns workspace board data in one service call', async () => {
    prisma.workspaceMembership.findUnique.mockResolvedValueOnce({
      id: 'membership-1',
      workspaceId: 'workspace-1',
      userId: 'user-1',
      role: 'owner',
      createdAt: new Date('2026-03-26T00:00:00.000Z'),
      workspace: {
        id: 'workspace-1',
        name: 'Product Team',
        slug: 'product-team',
        createdByUserId: 'user-1',
        createdAt: new Date('2026-03-26T00:00:00.000Z'),
        updatedAt: new Date('2026-03-26T00:00:00.000Z'),
      },
    });
    prisma.workspaceMembership.count.mockResolvedValueOnce(3);
    prisma.workspaceInvitation.count.mockResolvedValueOnce(2);
    membershipsService.listWorkspaceMembers.mockResolvedValueOnce([
      {
        id: 'membership-1',
        workspaceId: 'workspace-1',
        userId: 'user-1',
        role: 'owner',
        createdAt: '2026-03-26T00:00:00.000Z',
        user: {
          id: 'user-1',
          email: 'owner@example.com',
          displayName: 'Owner',
          createdAt: '2026-03-26T00:00:00.000Z',
          updatedAt: '2026-03-26T00:00:00.000Z',
        },
      },
    ]);
    tasksService.listTasksForWorkspace.mockResolvedValueOnce({
      tasks: [],
      limit: 50,
      hasMore: false,
      nextCursor: null,
    });

    const result = await service.getWorkspaceBoardDataForUser({
      workspaceId: 'workspace-1',
      currentUserId: 'user-1',
      assignment: 'everyone',
      includeMembers: true,
      limit: 50,
    });

    expect(result.workspace.id).toBe('workspace-1');
    expect(result.members).toHaveLength(1);
    expect(result.membersLoaded).toBe(true);
    expect(result.tasks).toEqual([]);
    expect(tasksService.listTasksForWorkspace).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      currentUserId: 'user-1',
      includeDescription: false,
      dueBucket: undefined,
      assignment: 'everyone',
      referenceDate: undefined,
      limit: 50,
      cursor: undefined,
    });
  });

  it('skips loading workspace members for board data when includeMembers is false', async () => {
    prisma.workspaceMembership.findUnique.mockResolvedValueOnce({
      id: 'membership-1',
      workspaceId: 'workspace-1',
      userId: 'user-1',
      role: 'owner',
      createdAt: new Date('2026-03-26T00:00:00.000Z'),
      workspace: {
        id: 'workspace-1',
        name: 'Product Team',
        slug: 'product-team',
        createdByUserId: 'user-1',
        createdAt: new Date('2026-03-26T00:00:00.000Z'),
        updatedAt: new Date('2026-03-26T00:00:00.000Z'),
      },
    });
    prisma.workspaceMembership.count.mockResolvedValueOnce(3);
    prisma.workspaceInvitation.count.mockResolvedValueOnce(2);
    tasksService.listTasksForWorkspace.mockResolvedValueOnce({
      tasks: [],
      limit: 50,
      hasMore: false,
      nextCursor: null,
    });

    const result = await service.getWorkspaceBoardDataForUser({
      workspaceId: 'workspace-1',
      currentUserId: 'user-1',
      includeMembers: false,
    });

    expect(result.members).toEqual([]);
    expect(result.membersLoaded).toBe(false);
    expect(membershipsService.listWorkspaceMembers).not.toHaveBeenCalled();
  });

  it('allows owners to delete a workspace', async () => {
    membershipsService.requireMembership.mockResolvedValueOnce({
      id: 'membership-1',
      workspaceId: 'workspace-1',
      userId: 'user-1',
      role: 'owner',
      createdAt: new Date('2026-03-26T00:00:00.000Z'),
    });
    prisma.workspace.delete.mockResolvedValueOnce({
      id: 'workspace-1',
    });

    await expect(service.deleteWorkspace('workspace-1', 'user-1')).resolves.toEqual({
      success: true,
    });

    expect(membershipsService.requireMembership).toHaveBeenCalledWith('workspace-1', 'user-1');
    expect(prisma.workspace.delete).toHaveBeenCalledWith({
      where: { id: 'workspace-1' },
    });
  });

  it('allows owners to rename a workspace', async () => {
    membershipsService.requireMembership.mockResolvedValueOnce({
      id: 'membership-1',
      workspaceId: 'workspace-1',
      userId: 'user-1',
      role: 'owner',
      createdAt: new Date('2026-03-26T00:00:00.000Z'),
    });
    prisma.workspace.update.mockResolvedValueOnce({
      id: 'workspace-1',
      name: 'Renamed Workspace',
      slug: 'product-team',
      createdByUserId: 'user-1',
      createdAt: new Date('2026-03-26T00:00:00.000Z'),
      updatedAt: new Date('2026-03-27T00:00:00.000Z'),
    });
    prisma.workspaceMembership.count.mockResolvedValueOnce(3);
    prisma.workspaceInvitation.count.mockResolvedValueOnce(2);

    const result = await service.updateWorkspaceName('workspace-1', '  Renamed   Workspace  ', 'user-1');

    expect(membershipsService.requireMembership).toHaveBeenCalledWith('workspace-1', 'user-1');
    expect(prisma.workspace.update).toHaveBeenCalledWith({
      where: { id: 'workspace-1' },
      data: { name: 'Renamed Workspace' },
    });
    expect(result.name).toBe('Renamed Workspace');
    expect(result.memberCount).toBe(3);
    expect(result.invitationCount).toBe(2);
  });

  it('rejects non-owners from renaming a workspace', async () => {
    membershipsService.requireMembership.mockResolvedValueOnce({
      id: 'membership-1',
      workspaceId: 'workspace-1',
      userId: 'user-1',
      role: 'member',
      createdAt: new Date('2026-03-26T00:00:00.000Z'),
    });

    await expect(
      service.updateWorkspaceName('workspace-1', 'Renamed Workspace', 'user-1'),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.workspace.update).not.toHaveBeenCalled();
  });

  it('rejects non-owners from deleting a workspace', async () => {
    membershipsService.requireMembership.mockResolvedValueOnce({
      id: 'membership-1',
      workspaceId: 'workspace-1',
      userId: 'user-1',
      role: 'member',
      createdAt: new Date('2026-03-26T00:00:00.000Z'),
    });

    await expect(service.deleteWorkspace('workspace-1', 'user-1')).rejects.toThrow(
      ForbiddenException,
    );
    expect(prisma.workspace.delete).not.toHaveBeenCalled();
  });

  it('transfers ownership from acting owner to another member', async () => {
    membershipsService.requireMembership
      .mockResolvedValueOnce({
        id: 'membership-owner',
        workspaceId: 'workspace-1',
        userId: 'user-1',
        role: 'owner',
        createdAt: new Date('2026-03-26T00:00:00.000Z'),
      })
      .mockResolvedValueOnce({
        id: 'membership-member',
        workspaceId: 'workspace-1',
        userId: 'user-2',
        role: 'member',
        createdAt: new Date('2026-03-26T00:00:00.000Z'),
      });
    prisma.workspaceMembership.update
      .mockResolvedValueOnce({
        id: 'membership-member',
        workspaceId: 'workspace-1',
        userId: 'user-2',
        role: 'owner',
        createdAt: new Date('2026-03-26T00:00:00.000Z'),
        user: {
          id: 'user-2',
          email: 'member@example.com',
          displayName: 'Member',
          createdAt: new Date('2026-03-26T00:00:00.000Z'),
          updatedAt: new Date('2026-03-26T00:00:00.000Z'),
        },
      })
      .mockResolvedValueOnce({
        id: 'membership-owner',
        workspaceId: 'workspace-1',
        userId: 'user-1',
        role: 'member',
        createdAt: new Date('2026-03-26T00:00:00.000Z'),
        user: {
          id: 'user-1',
          email: 'owner@example.com',
          displayName: 'Owner',
          createdAt: new Date('2026-03-26T00:00:00.000Z'),
          updatedAt: new Date('2026-03-26T00:00:00.000Z'),
        },
      });

    const result = await service.transferOwnership('workspace-1', 'user-1', 'user-2');

    expect(result.previousOwnerMembership.role).toBe('member');
    expect(result.nextOwnerMembership.role).toBe('owner');
    expect(prisma.workspaceMembership.update).toHaveBeenCalledTimes(2);
    expect(securityTelemetryService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'destructive',
        eventName: 'workspace.ownership.transfer',
        outcome: 'success',
      }),
    );
  });

  it('rejects ownership transfer when the acting user is not an owner', async () => {
    membershipsService.requireMembership
      .mockResolvedValueOnce({
        id: 'membership-owner',
        workspaceId: 'workspace-1',
        userId: 'user-1',
        role: 'member',
        createdAt: new Date('2026-03-26T00:00:00.000Z'),
      })
      .mockResolvedValueOnce({
        id: 'membership-member',
        workspaceId: 'workspace-1',
        userId: 'user-2',
        role: 'member',
        createdAt: new Date('2026-03-26T00:00:00.000Z'),
      });

    await expect(service.transferOwnership('workspace-1', 'user-1', 'user-2')).rejects.toThrow(
      ForbiddenException,
    );
    expect(prisma.workspaceMembership.update).not.toHaveBeenCalled();
    expect(securityTelemetryService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'destructive',
        eventName: 'workspace.ownership.transfer',
        outcome: 'failure',
      }),
    );
  });

  it('propagates missing membership failures when deleting a workspace', async () => {
    membershipsService.requireMembership.mockRejectedValueOnce(
      new ForbiddenException('You do not belong to this workspace.'),
    );

    await expect(service.deleteWorkspace('workspace-1', 'user-1')).rejects.toThrow(
      'You do not belong to this workspace.',
    );
    expect(prisma.workspace.delete).not.toHaveBeenCalled();
  });
});
