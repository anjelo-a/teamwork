import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import {
  Prisma,
  WorkspaceRole as PrismaWorkspaceRole,
  type User,
  type WorkspaceMembership,
} from '@prisma/client';
import type {
  WorkspaceMemberDetail,
  WorkspaceMembershipSummary,
  WorkspaceRole,
} from '@teamwork/types';
import { WorkspacePolicyService } from '../common/policy/workspace-policy.service';
import { SecurityTelemetryService } from '../common/security/security-telemetry.service';
import { isPrismaErrorCode } from '../common/utils/prisma-error.util';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';

type MembershipDatabase = Prisma.TransactionClient | PrismaService;
const MAX_SERIALIZABLE_RETRIES = 3;

@Injectable()
export class MembershipsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly workspacePolicyService: WorkspacePolicyService,
    private readonly securityTelemetryService: SecurityTelemetryService,
  ) {}

  async createMembership(
    input: {
      workspaceId: string;
      userId: string;
      role: WorkspaceRole;
    },
    db: MembershipDatabase = this.prisma,
  ) {
    try {
      return await db.workspaceMembership.create({
        data: {
          workspaceId: input.workspaceId,
          userId: input.userId,
          role: toPrismaRole(input.role),
        },
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException('The user is already a member of this workspace.');
      }

      throw error;
    }
  }

  async requireMembership(
    workspaceId: string,
    userId: string,
    db: MembershipDatabase = this.prisma,
  ) {
    const membership = await db.workspaceMembership.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException('You do not belong to this workspace.');
    }

    return membership;
  }

  async listWorkspaceMembers(workspaceId: string): Promise<WorkspaceMemberDetail[]> {
    const memberships = await this.prisma.workspaceMembership.findMany({
      where: { workspaceId },
      include: { user: true },
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    });

    return memberships.map((membership) => this.toDetail(membership, membership.user));
  }

  async updateMemberRole(
    workspaceId: string,
    userId: string,
    role: WorkspaceRole,
  ): Promise<WorkspaceMemberDetail> {
    return this.runInSerializableTransaction(async (tx) => {
      const membership = await this.requireMembership(workspaceId, userId, tx);

      if (membership.role === PrismaWorkspaceRole.owner && role !== 'owner') {
        await this.ensureWorkspaceHasAnotherOwner(workspaceId, userId, tx);
      }

      const updatedMembership = await tx.workspaceMembership.update({
        where: { id: membership.id },
        data: { role: toPrismaRole(role) },
        include: { user: true },
      });

      return this.toDetail(updatedMembership, updatedMembership.user);
    });
  }

  async removeMember(workspaceId: string, userId: string, actingUserId: string) {
    try {
      return await this.runInSerializableTransaction(async (tx) => {
        const membership = await this.requireMembership(workspaceId, userId, tx);
        const actingMembership =
          actingUserId === userId
            ? membership
            : await this.requireMembership(workspaceId, actingUserId, tx);

        this.workspacePolicyService.assertCanRemoveMember({
          actingUserId,
          targetUserId: userId,
          actingMembership: {
            userId: actingMembership.userId,
            role: actingMembership.role as WorkspaceRole,
          },
        });

        if (membership.role === PrismaWorkspaceRole.owner) {
          await this.ensureWorkspaceHasAnotherOwner(workspaceId, userId, tx);
        }

        await tx.workspaceMembership.delete({
          where: { id: membership.id },
        });

        this.securityTelemetryService.record({
          category: 'destructive',
          eventName: 'workspace.member.remove',
          outcome: 'success',
          severity: 'warning',
          workspaceId,
          actorUserId: actingUserId,
          details: {
            removedUserId: userId,
            removedOwnMembership: actingUserId === userId,
          },
        });

        return { success: true };
      });
    } catch (error) {
      this.securityTelemetryService.record({
        category: 'destructive',
        eventName: 'workspace.member.remove',
        outcome: 'failure',
        severity: 'warning',
        workspaceId,
        actorUserId: actingUserId,
        details: {
          removedUserId: userId,
          reason: error instanceof Error ? error.message : 'unknown_error',
        },
      });
      throw error;
    }
  }

  toSummary(
    membership: Pick<WorkspaceMembership, 'id' | 'workspaceId' | 'userId' | 'role' | 'createdAt'>,
  ): WorkspaceMembershipSummary {
    return {
      id: membership.id,
      workspaceId: membership.workspaceId,
      userId: membership.userId,
      role: membership.role,
      createdAt: membership.createdAt.toISOString(),
    };
  }

  toDetail(
    membership: Pick<WorkspaceMembership, 'id' | 'workspaceId' | 'userId' | 'role' | 'createdAt'>,
    user: Pick<User, 'id' | 'email' | 'displayName' | 'createdAt' | 'updatedAt'>,
  ): WorkspaceMemberDetail {
    return {
      ...this.toSummary(membership),
      user: this.usersService.toSummary(user),
    };
  }

  async ensureWorkspaceHasAnotherOwner(
    workspaceId: string,
    excludedUserId: string,
    db: MembershipDatabase = this.prisma,
  ) {
    const ownerCount = await db.workspaceMembership.count({
      where: {
        workspaceId,
        role: PrismaWorkspaceRole.owner,
        userId: { not: excludedUserId },
      },
    });

    if (ownerCount === 0) {
      throw new BadRequestException('Workspace must keep at least one owner.');
    }
  }

  private async runInSerializableTransaction<T>(
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await this.prisma.$transaction(operation, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error) {
        if (!isRetryableTransactionError(error) || attempt >= MAX_SERIALIZABLE_RETRIES - 1) {
          throw error;
        }
      }
    }
  }
}

function toPrismaRole(role: WorkspaceRole): PrismaWorkspaceRole {
  return role === 'owner' ? PrismaWorkspaceRole.owner : PrismaWorkspaceRole.member;
}

function isUniqueConstraintError(error: unknown): boolean {
  return isPrismaErrorCode(error, 'P2002');
}

function isRetryableTransactionError(error: unknown): boolean {
  return isPrismaErrorCode(error, 'P2034');
}
