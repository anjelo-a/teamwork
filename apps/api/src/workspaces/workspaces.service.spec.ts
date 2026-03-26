import { WorkspacesService } from './workspaces.service';

describe('WorkspacesService', () => {
  let prisma: {
    workspace: {
      findUnique: jest.Mock;
      create: jest.Mock;
    };
    workspaceMembership: {
      findUniqueOrThrow: jest.Mock;
      findUnique: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let membershipsService: {
    createMembership: jest.Mock;
    toSummary: jest.Mock;
  };
  let service: WorkspacesService;

  beforeEach(() => {
    prisma = {
      workspace: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      workspaceMembership: {
        findUniqueOrThrow: jest.fn(),
        findUnique: jest.fn(),
      },
      $transaction: jest.fn(async (callback) => callback(prisma)),
    };
    membershipsService = {
      createMembership: jest.fn(),
      toSummary: jest.fn((membership) => membership),
    };

    service = new WorkspacesService(
      prisma as never,
      membershipsService as never,
    );
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
        _count: {
          memberships: 3,
          invitations: 2,
        },
      },
    });

    const result = await service.getWorkspaceForUser('workspace-1', 'user-1');

    expect(result.memberCount).toBe(3);
    expect(result.invitationCount).toBe(2);
  });
});
