import { Test } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { WorkspacesService } from './workspaces.service';
import type { WorkspaceMembershipSummary } from '@teamwork/types';
import { MembershipsService } from '../memberships/memberships.service';
import { PrismaService } from '../prisma/prisma.service';

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
      delete: jest.Mock;
    };
    workspaceMembership: {
      findUniqueOrThrow: jest.Mock;
      findUnique: jest.Mock;
      count: jest.Mock;
    };
    workspaceInvitation: {
      count: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let membershipsService: {
    createMembership: jest.Mock;
    requireMembership: jest.Mock;
    toSummary: jest.Mock;
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
        delete: jest.fn(),
      },
      workspaceMembership: {
        findUniqueOrThrow: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
      },
      workspaceInvitation: {
        count: jest.fn(),
      },
      $transaction: jest.fn(runInTransaction),
    };
    membershipsService = {
      createMembership: jest.fn(),
      requireMembership: jest.fn(),
      toSummary: jest.fn(
        (membership: WorkspaceMembershipRecord): WorkspaceMembershipSummary =>
          toMembershipSummary(membership),
      ),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        WorkspacesService,
        { provide: PrismaService, useValue: prisma },
        { provide: MembershipsService, useValue: membershipsService },
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
