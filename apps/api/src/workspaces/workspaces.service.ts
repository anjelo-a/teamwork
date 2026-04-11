import { Injectable, NotFoundException } from '@nestjs/common';
import {
  Prisma,
  WorkspaceRole as PrismaWorkspaceRole,
  type Workspace,
  type WorkspaceMembership,
} from '@prisma/client';
import type {
  AuthenticatedWorkspace,
  WorkspaceRole,
  TaskAssignmentFilter,
  TaskDueBucket,
  WorkspaceBoardDataResponse,
  WorkspaceDetails,
  WorkspaceSummary,
} from '@teamwork/types';
import { normalizeWorkspaceName } from '@teamwork/validation';
import { isPrismaUniqueConstraintForField } from '../common/utils/prisma-error.util';
import { MembershipsService } from '../memberships/memberships.service';
import { PrismaService } from '../prisma/prisma.service';
import { TasksService } from '../tasks/tasks.service';
import { slugify } from '../common/utils/slug.util';
import { WorkspacePolicyService, type WorkspacePolicyAction } from '../common/policy/workspace-policy.service';
import { SecurityTelemetryService } from '../common/security/security-telemetry.service';

type WorkspaceMembershipCountArgs = NonNullable<
  Parameters<PrismaService['workspaceMembership']['count']>[0]
>;
type WorkspaceInvitationCountArgs = NonNullable<
  Parameters<PrismaService['workspaceInvitation']['count']>[0]
>;

interface WorkspaceRepository {
  create<T extends Prisma.WorkspaceCreateArgs>(
    args: Prisma.SelectSubset<T, Prisma.WorkspaceCreateArgs>,
  ): Promise<Prisma.WorkspaceGetPayload<T>>;
  update<T extends Prisma.WorkspaceUpdateArgs>(
    args: Prisma.SelectSubset<T, Prisma.WorkspaceUpdateArgs>,
  ): Promise<Prisma.WorkspaceGetPayload<T>>;
  delete<T extends Prisma.WorkspaceDeleteArgs>(
    args: Prisma.SelectSubset<T, Prisma.WorkspaceDeleteArgs>,
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
  count(args: WorkspaceMembershipCountArgs): Promise<number>;
}

interface WorkspaceInvitationRepository {
  count(args: WorkspaceInvitationCountArgs): Promise<number>;
}

interface WorkspaceDatabase {
  workspace: WorkspaceRepository;
  workspaceMembership: WorkspaceMembershipRepository;
  workspaceInvitation: WorkspaceInvitationRepository;
}

const MAX_WORKSPACE_CREATE_RETRIES = 3;

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
    private readonly tasksService: TasksService,
    private readonly workspacePolicyService: WorkspacePolicyService,
    private readonly securityTelemetryService: SecurityTelemetryService,
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

  async updateWorkspaceName(
    workspaceId: string,
    name: string,
    actingUserId: string,
  ): Promise<WorkspaceDetails> {
    try {
      const membership = await this.membershipsService.requireMembership(workspaceId, actingUserId);
      this.assertWorkspacePolicy('workspace.settings.update', membership, workspaceId, actingUserId);

      const normalizedName = normalizeWorkspaceName(name);
      const db = toWorkspaceDatabase(this.prisma);
      const updatedWorkspace = await db.workspace.update({
        where: { id: workspaceId },
        data: { name: normalizedName },
      });

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
        ...this.toAuthenticatedWorkspace(updatedWorkspace, membership),
        memberCount,
        invitationCount,
      };
    } catch (error) {
      this.securityTelemetryService.record({
        category: 'authorization',
        eventName: 'workspace.settings.update',
        outcome: 'failure',
        workspaceId,
        actorUserId: actingUserId,
        details: {
          reason: error instanceof Error ? error.message : 'unknown_error',
        },
      });
      throw error;
    }
  }

  async createWorkspaceForUser(name: string, userId: string): Promise<WorkspaceDetails> {
    return this.runCreateWorkspaceTransaction(async () =>
      this.prisma.$transaction(async (tx) => {
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
      }),
    );
  }

  async getWorkspaceBoardDataForUser(input: {
    workspaceId: string;
    currentUserId: string;
    includeMembers?: boolean;
    dueBucket?: TaskDueBucket;
    assignment?: TaskAssignmentFilter;
    referenceDate?: string | null;
    limit?: number;
    cursor?: string;
  }): Promise<WorkspaceBoardDataResponse> {
    const includeMembers = input.includeMembers ?? true;
    const [workspace, members, taskList] = await Promise.all([
      this.getWorkspaceForUser(input.workspaceId, input.currentUserId),
      includeMembers
        ? this.membershipsService.listWorkspaceMembers(input.workspaceId)
        : Promise.resolve([]),
      this.tasksService.listTasksForWorkspace({
        workspaceId: input.workspaceId,
        currentUserId: input.currentUserId,
        includeDescription: false,
        ...(input.dueBucket !== undefined ? { dueBucket: input.dueBucket } : {}),
        ...(input.assignment !== undefined ? { assignment: input.assignment } : {}),
        ...(input.referenceDate !== undefined ? { referenceDate: input.referenceDate } : {}),
        ...(input.limit !== undefined ? { limit: input.limit } : {}),
        ...(input.cursor !== undefined ? { cursor: input.cursor } : {}),
      }),
    ]);

    return {
      workspace,
      members,
      membersLoaded: includeMembers,
      ...taskList,
    };
  }

  async deleteWorkspace(workspaceId: string, actingUserId: string): Promise<{ success: true }> {
    try {
      const membership = await this.membershipsService.requireMembership(workspaceId, actingUserId);
      this.assertWorkspacePolicy('workspace.delete', membership, workspaceId, actingUserId);

      await toWorkspaceDatabase(this.prisma).workspace.delete({
        where: { id: workspaceId },
      });

      this.securityTelemetryService.record({
        category: 'destructive',
        eventName: 'workspace.delete',
        outcome: 'success',
        severity: 'critical',
        workspaceId,
        actorUserId: actingUserId,
      });

      return { success: true };
    } catch (error) {
      this.securityTelemetryService.record({
        category: 'destructive',
        eventName: 'workspace.delete',
        outcome: 'failure',
        severity: 'warning',
        workspaceId,
        actorUserId: actingUserId,
        details: {
          reason: error instanceof Error ? error.message : 'unknown_error',
        },
      });
      throw error;
    }
  }

  async transferOwnership(
    workspaceId: string,
    actingUserId: string,
    nextOwnerUserId: string,
  ): Promise<{
    previousOwnerMembership: ReturnType<MembershipsService['toDetail']>;
    nextOwnerMembership: ReturnType<MembershipsService['toDetail']>;
  }> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const actingMembership = await this.membershipsService.requireMembership(
          workspaceId,
          actingUserId,
          tx,
        );
        const nextOwnerMembership = await this.membershipsService.requireMembership(
          workspaceId,
          nextOwnerUserId,
          tx,
        );

        this.workspacePolicyService.assertCanTransferOwnership({
          actingUserId,
          nextOwnerUserId,
          actingMembership: {
            userId: actingMembership.userId,
            role: actingMembership.role as WorkspaceRole,
          },
          nextOwnerMembership: {
            userId: nextOwnerMembership.userId,
            role: nextOwnerMembership.role as WorkspaceRole,
          },
        });

        const promotedMembership = await tx.workspaceMembership.update({
          where: { id: nextOwnerMembership.id },
          data: { role: PrismaWorkspaceRole.owner },
          include: { user: true },
        });
        const demotedMembership = await tx.workspaceMembership.update({
          where: { id: actingMembership.id },
          data: { role: PrismaWorkspaceRole.member },
          include: { user: true },
        });

        this.securityTelemetryService.record({
          category: 'destructive',
          eventName: 'workspace.ownership.transfer',
          outcome: 'success',
          severity: 'warning',
          workspaceId,
          actorUserId: actingUserId,
          details: {
            nextOwnerUserId,
          },
        });

        return {
          previousOwnerMembership: this.membershipsService.toDetail(
            demotedMembership,
            demotedMembership.user,
          ),
          nextOwnerMembership: this.membershipsService.toDetail(
            promotedMembership,
            promotedMembership.user,
          ),
        };
      });
    } catch (error) {
      this.securityTelemetryService.record({
        category: 'destructive',
        eventName: 'workspace.ownership.transfer',
        outcome: 'failure',
        severity: 'warning',
        workspaceId,
        actorUserId: actingUserId,
        details: {
          nextOwnerUserId,
          reason: error instanceof Error ? error.message : 'unknown_error',
        },
      });
      throw error;
    }
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

  private assertWorkspacePolicy(
    action: WorkspacePolicyAction,
    membership: Pick<WorkspaceMembership, 'role'>,
    workspaceId: string,
    actingUserId: string,
  ): void {
    try {
      this.workspacePolicyService.assertCanPerformAction(action, membership);
    } catch (error) {
      this.securityTelemetryService.record({
        category: 'authorization',
        eventName: action,
        outcome: 'failure',
        workspaceId,
        actorUserId: actingUserId,
        details: {
          reason: error instanceof Error ? error.message : 'unknown_error',
        },
      });
      throw error;
    }
  }

  private async runCreateWorkspaceTransaction<T>(operation: () => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        if (
          !isPrismaUniqueConstraintForField(error, 'slug') ||
          attempt >= MAX_WORKSPACE_CREATE_RETRIES - 1
        ) {
          throw error;
        }
      }
    }
  }
}
