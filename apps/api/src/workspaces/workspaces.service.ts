import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type Workspace, type WorkspaceMembership } from '@prisma/client';
import type { AuthenticatedWorkspace, WorkspaceDetails, WorkspaceSummary } from '@teamwork/types';
import { normalizeWorkspaceName } from '@teamwork/validation';
import { MembershipsService } from '../memberships/memberships.service';
import { PrismaService } from '../prisma/prisma.service';
import { slugify } from '../common/utils/slug.util';

interface WorkspaceRepository {
  create<T extends Prisma.WorkspaceCreateArgs>(
    args: Prisma.SelectSubset<T, Prisma.WorkspaceCreateArgs>,
  ): Promise<Prisma.WorkspaceGetPayload<T>>;
  findUnique<T extends Prisma.WorkspaceFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.WorkspaceFindUniqueArgs>,
  ): Promise<Prisma.WorkspaceGetPayload<T> | null>;
}

interface WorkspaceMembershipRepository {
  findMany<T extends Prisma.WorkspaceMembershipFindManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.WorkspaceMembershipFindManyArgs>,
  ): Promise<Array<Prisma.WorkspaceMembershipGetPayload<T>>>;
  findUnique<T extends Prisma.WorkspaceMembershipFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.WorkspaceMembershipFindUniqueArgs>,
  ): Promise<Prisma.WorkspaceMembershipGetPayload<T> | null>;
  findUniqueOrThrow<T extends Prisma.WorkspaceMembershipFindUniqueOrThrowArgs>(
    args: Prisma.SelectSubset<T, Prisma.WorkspaceMembershipFindUniqueOrThrowArgs>,
  ): Promise<Prisma.WorkspaceMembershipGetPayload<T>>;
  count(args: Prisma.WorkspaceMembershipCountArgs): Promise<number>;
}

interface WorkspaceInvitationRepository {
  count(args: Prisma.WorkspaceInvitationCountArgs): Promise<number>;
}

interface WorkspaceDatabase {
  workspace: WorkspaceRepository;
  workspaceMembership: WorkspaceMembershipRepository;
  workspaceInvitation: WorkspaceInvitationRepository;
}

function toWorkspaceDatabase(db: Prisma.TransactionClient | PrismaService): WorkspaceDatabase {
  return {
    workspace: db.workspace,
    workspaceMembership: db.workspaceMembership,
    workspaceInvitation: db.workspaceInvitation,
  };
}

@Injectable()
export class WorkspacesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membershipsService: MembershipsService,
  ) {}

  async createWorkspace(
    input: { name: string; createdByUserId: string },
    db: WorkspaceDatabase = toWorkspaceDatabase(this.prisma),
  ): Promise<Workspace> {
    const normalizedName = normalizeWorkspaceName(input.name);
    const slug = await this.generateUniqueSlug(normalizedName, db);

    return db.workspace.create({
      data: {
        name: normalizedName,
        slug,
        createdByUserId: input.createdByUserId,
      },
    });
  }

  async listForUser(userId: string): Promise<AuthenticatedWorkspace[]> {
    const memberships = await toWorkspaceDatabase(this.prisma).workspaceMembership.findMany({
      where: { userId },
      include: { workspace: true },
      orderBy: { createdAt: 'asc' },
    });

    return memberships.map((membership) =>
      this.toAuthenticatedWorkspace(membership.workspace, membership),
    );
  }

  async getWorkspaceForUser(workspaceId: string, userId: string): Promise<WorkspaceDetails> {
    const db = toWorkspaceDatabase(this.prisma);
    const membership = await db.workspaceMembership.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
      include: {
        workspace: true,
      },
    });

    if (!membership) {
      throw new NotFoundException('Workspace not found.');
    }

    const [memberCount, invitationCount] = await Promise.all([
      db.workspaceMembership.count({
        where: { workspaceId },
      }),
      db.workspaceInvitation.count({
        where: {
          workspaceId,
          acceptedAt: null,
          revokedAt: null,
        },
      }),
    ]);

    return {
      ...this.toAuthenticatedWorkspace(membership.workspace, membership),
      memberCount,
      invitationCount,
    };
  }

  async createWorkspaceForUser(name: string, userId: string): Promise<WorkspaceDetails> {
    return this.prisma.$transaction(async (tx) => {
      const db = toWorkspaceDatabase(tx);
      const workspace = await this.createWorkspace(
        {
          name,
          createdByUserId: userId,
        },
        db,
      );

      await this.membershipsService.createMembership(
        {
          workspaceId: workspace.id,
          userId,
          role: 'owner',
        },
        tx,
      );

      const membership = await db.workspaceMembership.findUniqueOrThrow({
        where: {
          workspaceId_userId: {
            workspaceId: workspace.id,
            userId,
          },
        },
      });

      return {
        ...this.toAuthenticatedWorkspace(workspace, membership),
        memberCount: 1,
        invitationCount: 0,
      };
    });
  }

  toSummary(
    workspace: Pick<
      Workspace,
      'id' | 'name' | 'slug' | 'createdByUserId' | 'createdAt' | 'updatedAt'
    >,
  ): WorkspaceSummary {
    return {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      createdByUserId: workspace.createdByUserId,
      createdAt: workspace.createdAt.toISOString(),
      updatedAt: workspace.updatedAt.toISOString(),
    };
  }

  private toAuthenticatedWorkspace(
    workspace: Pick<
      Workspace,
      'id' | 'name' | 'slug' | 'createdByUserId' | 'createdAt' | 'updatedAt'
    >,
    membership: Pick<WorkspaceMembership, 'id' | 'workspaceId' | 'userId' | 'role' | 'createdAt'>,
  ): AuthenticatedWorkspace {
    return {
      ...this.toSummary(workspace),
      membership: this.membershipsService.toSummary(membership),
    };
  }

  private async generateUniqueSlug(workspaceName: string, db: WorkspaceDatabase): Promise<string> {
    const baseSlug = slugify(workspaceName);
    let attempt = 0;

    for (;;) {
      const slug = attempt === 0 ? baseSlug : `${baseSlug}-${String(attempt + 1)}`;
      const existingWorkspace = await db.workspace.findUnique({
        where: { slug },
        select: { id: true },
      });

      if (!existingWorkspace) {
        return slug;
      }

      attempt += 1;
    }
  }
}
