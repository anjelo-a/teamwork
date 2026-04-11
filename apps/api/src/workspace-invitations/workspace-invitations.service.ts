import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import { Prisma, type WorkspaceInvitation, type WorkspaceShareLink } from '@prisma/client';
import { normalizeEmail } from '@teamwork/validation';
import type {
  InviteWorkspaceMemberResult,
  PublicWorkspaceInvitationLookup,
  PublicWorkspaceInvitationSummary,
  PublicWorkspaceInvitationStatus,
  PublicWorkspaceShareLinkLookup,
  PublicWorkspaceShareLinkSummary,
  WorkspaceInvitationSummary,
  WorkspaceRole,
  WorkspaceShareLinkStatus,
  WorkspaceShareLinkSummary,
  WorkspaceSummary,
} from '@teamwork/types';
import type { RequestUser } from '../common/interfaces/request-user.interface';
import { isPrismaErrorCode } from '../common/utils/prisma-error.util';
import { SecurityTelemetryService } from '../common/security/security-telemetry.service';
import { MembershipsService } from '../memberships/memberships.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';

const invitationSummarySelect = {
  id: true,
  workspaceId: true,
  email: true,
  role: true,
  invitedByUserId: true,
  expiresAt: true,
  createdAt: true,
  acceptedAt: true,
  revokedAt: true,
} satisfies Prisma.WorkspaceInvitationSelect;
const publicInvitationSummarySelect = {
  id: true,
  workspaceId: true,
  role: true,
  expiresAt: true,
  createdAt: true,
  acceptedAt: true,
  revokedAt: true,
} satisfies Prisma.WorkspaceInvitationSelect;

const workspaceSummarySelect = {
  id: true,
  name: true,
  slug: true,
  createdByUserId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.WorkspaceSelect;
const invitationWithWorkspaceSelect = {
  ...invitationSummarySelect,
  workspace: {
    select: workspaceSummarySelect,
  },
} satisfies Prisma.WorkspaceInvitationSelect;
const publicInvitationWithWorkspaceSelect = {
  ...publicInvitationSummarySelect,
  workspace: {
    select: workspaceSummarySelect,
  },
} satisfies Prisma.WorkspaceInvitationSelect;
const workspaceShareLinkSummarySelect = {
  id: true,
  workspaceId: true,
  tokenHash: true,
  role: true,
  createdByUserId: true,
  expiresAt: true,
  revokedAt: true,
  lastUsedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.WorkspaceShareLinkSelect;
const workspaceShareLinkWithWorkspaceSelect = {
  ...workspaceShareLinkSummarySelect,
  workspace: {
    select: workspaceSummarySelect,
  },
} satisfies Prisma.WorkspaceShareLinkSelect;

type InvitationSummaryRecord = Prisma.WorkspaceInvitationGetPayload<{
  select: typeof invitationSummarySelect;
}>;
type WorkspaceShareLinkSummaryRecord = Prisma.WorkspaceShareLinkGetPayload<{
  select: typeof workspaceShareLinkSummarySelect;
}>;
type WorkspaceSummaryRecord = Prisma.WorkspaceGetPayload<{
  select: typeof workspaceSummarySelect;
}>;

interface WorkspaceInvitationRepository {
  findMany<T extends Prisma.WorkspaceInvitationFindManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.WorkspaceInvitationFindManyArgs>,
  ): Promise<Array<Prisma.WorkspaceInvitationGetPayload<T>>>;
  findFirst<T extends Prisma.WorkspaceInvitationFindFirstArgs>(
    args: Prisma.SelectSubset<T, Prisma.WorkspaceInvitationFindFirstArgs>,
  ): Promise<Prisma.WorkspaceInvitationGetPayload<T> | null>;
  findUnique<T extends Prisma.WorkspaceInvitationFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.WorkspaceInvitationFindUniqueArgs>,
  ): Promise<Prisma.WorkspaceInvitationGetPayload<T> | null>;
  create<T extends Prisma.WorkspaceInvitationCreateArgs>(
    args: Prisma.SelectSubset<T, Prisma.WorkspaceInvitationCreateArgs>,
  ): Promise<Prisma.WorkspaceInvitationGetPayload<T>>;
  update<T extends Prisma.WorkspaceInvitationUpdateArgs>(
    args: Prisma.SelectSubset<T, Prisma.WorkspaceInvitationUpdateArgs>,
  ): Promise<Prisma.WorkspaceInvitationGetPayload<T>>;
  updateMany<T extends Prisma.WorkspaceInvitationUpdateManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.WorkspaceInvitationUpdateManyArgs>,
  ): Promise<Prisma.BatchPayload>;
}

interface WorkspaceMembershipRepository {
  findUnique<T extends Prisma.WorkspaceMembershipFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.WorkspaceMembershipFindUniqueArgs>,
  ): Promise<Prisma.WorkspaceMembershipGetPayload<T> | null>;
}

interface WorkspaceShareLinkRepository {
  findFirst<T extends Prisma.WorkspaceShareLinkFindFirstArgs>(
    args: Prisma.SelectSubset<T, Prisma.WorkspaceShareLinkFindFirstArgs>,
  ): Promise<Prisma.WorkspaceShareLinkGetPayload<T> | null>;
  findUnique<T extends Prisma.WorkspaceShareLinkFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.WorkspaceShareLinkFindUniqueArgs>,
  ): Promise<Prisma.WorkspaceShareLinkGetPayload<T> | null>;
  create<T extends Prisma.WorkspaceShareLinkCreateArgs>(
    args: Prisma.SelectSubset<T, Prisma.WorkspaceShareLinkCreateArgs>,
  ): Promise<Prisma.WorkspaceShareLinkGetPayload<T>>;
  createMany<T extends Prisma.WorkspaceShareLinkCreateManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.WorkspaceShareLinkCreateManyArgs>,
  ): Promise<Prisma.BatchPayload>;
  update<T extends Prisma.WorkspaceShareLinkUpdateArgs>(
    args: Prisma.SelectSubset<T, Prisma.WorkspaceShareLinkUpdateArgs>,
  ): Promise<Prisma.WorkspaceShareLinkGetPayload<T>>;
  updateMany<T extends Prisma.WorkspaceShareLinkUpdateManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.WorkspaceShareLinkUpdateManyArgs>,
  ): Promise<Prisma.BatchPayload>;
}

interface InvitationDatabase {
  workspaceInvitation: WorkspaceInvitationRepository;
  workspaceMembership: WorkspaceMembershipRepository;
  workspaceShareLink: WorkspaceShareLinkRepository;
}

type AcceptInvitationLookup =
  | {
      invitationId: string;
    }
  | {
      token: string;
    };

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const INVITE_TOKEN_PATTERN = /^[a-zA-Z0-9_-]{8,256}$/;

interface SecurityAuditContext {
  actorUserId?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

function toInvitationDatabase(db: Prisma.TransactionClient | PrismaService): InvitationDatabase {
  return {
    workspaceInvitation: db.workspaceInvitation,
    workspaceMembership: db.workspaceMembership,
    workspaceShareLink: db.workspaceShareLink,
  };
}

@Injectable()
export class WorkspaceInvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly membershipsService: MembershipsService,
    private readonly usersService: UsersService,
    private readonly securityTelemetryService: SecurityTelemetryService,
  ) {}

  async inviteMember(
    workspaceId: string,
    email: string,
    role: WorkspaceRole,
    invitedByUserId: string,
  ): Promise<InviteWorkspaceMemberResult> {
    const normalizedEmail = normalizeEmail(email);

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const db = toInvitationDatabase(tx);

        await this.revokeExpiredPendingInvitations(workspaceId, normalizedEmail, db);
        await this.ensureNoActiveInvitation(workspaceId, normalizedEmail, db);
        const token = createInvitationToken();
        const invitation = await this.createInvitation(
          {
            workspaceId,
            email: normalizedEmail,
            token,
            role,
            invitedByUserId,
          },
          db,
        );

        return {
          kind: 'invitation' as const,
          invitation: this.toSummary(invitation),
          token,
          inviteUrl: this.buildInviteUrl(token),
        };
      });

      this.securityTelemetryService.record({
        category: 'invitation',
        eventName: 'invitation.create',
        outcome: 'success',
        workspaceId,
        actorUserId: invitedByUserId,
        details: {
          role,
        },
      });

      return result;
    } catch (error) {
      this.securityTelemetryService.record({
        category: 'invitation',
        eventName: 'invitation.create',
        outcome: 'failure',
        workspaceId,
        actorUserId: invitedByUserId,
        details: {
          role,
          reason: error instanceof Error ? error.message : 'unknown_error',
        },
      });
      throw error;
    }
  }

  async listPendingInvitations(workspaceId: string): Promise<WorkspaceInvitationSummary[]> {
    const invitations = await toInvitationDatabase(this.prisma).workspaceInvitation.findMany({
      where: {
        workspaceId,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      select: invitationSummarySelect,
      orderBy: { createdAt: 'asc' },
    });

    return invitations.map((invitation) => this.toSummary(invitation));
  }

  async listPendingInvitationsForEmail(email: string): Promise<
    Array<{
      invitation: WorkspaceInvitationSummary;
      workspace: WorkspaceSummary;
    }>
  > {
    const normalizedEmail = normalizeEmail(email);
    const invitations = await toInvitationDatabase(this.prisma).workspaceInvitation.findMany({
      where: {
        email: normalizedEmail,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      select: invitationWithWorkspaceSelect,
      orderBy: { createdAt: 'asc' },
    });

    return invitations.map((invitation) => ({
      invitation: this.toSummary(invitation),
      workspace: this.toWorkspaceSummary(invitation.workspace),
    }));
  }

  async getInvitationByToken(
    token: string,
    auditContext: SecurityAuditContext = {},
  ): Promise<PublicWorkspaceInvitationLookup> {
    const normalizedToken = normalizePublicToken(token);

    if (!normalizedToken) {
      this.auditSecurityEvent('invitation.lookup', 'failure', {
        ...auditContext,
        reason: 'invalid_token_format',
      });
      throw new NotFoundException('Invitation not found.');
    }

    const invitation = await toInvitationDatabase(this.prisma).workspaceInvitation.findUnique({
      where: {
        tokenHash: createInvitationTokenHash(normalizedToken),
      },
      select: publicInvitationWithWorkspaceSelect,
    });

    if (!invitation) {
      this.auditSecurityEvent('invitation.lookup', 'failure', {
        ...auditContext,
        reason: 'not_found',
      });
      throw new NotFoundException('Invitation not found.');
    }

    this.auditSecurityEvent('invitation.lookup', 'success', {
      ...auditContext,
      invitationId: invitation.id,
      workspaceId: invitation.workspaceId,
      status: this.toPublicStatus(invitation),
    });

    return {
      invitation: this.toPublicSummary(invitation),
      workspace: this.toWorkspaceSummary(invitation.workspace),
      status: this.toPublicStatus(invitation),
    };
  }

  async revokeInvitation(
    workspaceId: string,
    invitationId: string,
    actingUserId?: string,
  ): Promise<{ invitation: WorkspaceInvitationSummary }> {
    try {
      const invitationStore = toInvitationDatabase(this.prisma).workspaceInvitation;
      const invitation = await invitationStore.findFirst({
        where: {
          id: invitationId,
          workspaceId,
          acceptedAt: null,
          revokedAt: null,
        },
        select: invitationSummarySelect,
      });

      if (!invitation) {
        throw new NotFoundException('Invitation not found.');
      }

      const revokedInvitation = await invitationStore.update({
        where: { id: invitation.id },
        data: { revokedAt: new Date() },
        select: invitationSummarySelect,
      });

      this.securityTelemetryService.record({
        category: 'destructive',
        eventName: 'invitation.revoke',
        outcome: 'success',
        workspaceId,
        actorUserId: actingUserId ?? null,
        details: {
          invitationId,
        },
      });

      return {
        invitation: this.toSummary(revokedInvitation),
      };
    } catch (error) {
      this.securityTelemetryService.record({
        category: 'destructive',
        eventName: 'invitation.revoke',
        outcome: 'failure',
        workspaceId,
        actorUserId: actingUserId ?? null,
        details: {
          invitationId,
          reason: error instanceof Error ? error.message : 'unknown_error',
        },
      });
      throw error;
    }
  }

  async revokeAllPendingInvitations(
    workspaceId: string,
    actingUserId: string,
  ): Promise<{ revokedCount: number }> {
    const now = new Date();

    try {
      const result = await toInvitationDatabase(this.prisma).workspaceInvitation.updateMany({
        where: {
          workspaceId,
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        data: {
          revokedAt: now,
        },
      });

      this.securityTelemetryService.record({
        category: 'destructive',
        eventName: 'invitation.revoke_all',
        outcome: 'success',
        workspaceId,
        actorUserId: actingUserId,
        details: {
          revokedCount: result.count,
        },
      });

      return {
        revokedCount: result.count,
      };
    } catch (error) {
      this.securityTelemetryService.record({
        category: 'destructive',
        eventName: 'invitation.revoke_all',
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

  async getWorkspaceShareLink(
    workspaceId: string,
    createdByUserId: string,
  ): Promise<{ shareLink: WorkspaceShareLinkSummary }> {
    return this.prisma.$transaction(async (tx) => {
      const { shareLink, token } = await this.getOrCreateWorkspaceShareLink(
        workspaceId,
        createdByUserId,
        toInvitationDatabase(tx),
      );

      return {
        shareLink: this.toWorkspaceShareLinkSummary(shareLink, token),
      };
    });
  }

  async updateWorkspaceShareLink(
    workspaceId: string,
    role: WorkspaceRole,
    createdByUserId: string,
  ): Promise<{ shareLink: WorkspaceShareLinkSummary }> {
    if (role !== 'member') {
      throw new BadRequestException('Workspace share links can only grant member access.');
    }

    return this.prisma.$transaction(async (tx) => {
      const db = toInvitationDatabase(tx);
      const { shareLink } = await this.getOrCreateWorkspaceShareLink(
        workspaceId,
        createdByUserId,
        db,
      );
      const updatedShareLink = await db.workspaceShareLink.update({
        where: { id: shareLink.id },
        data: { role, revokedAt: null },
        select: workspaceShareLinkSummarySelect,
      });

      return {
        shareLink: this.toWorkspaceShareLinkSummary(updatedShareLink),
      };
    });
  }

  async regenerateWorkspaceShareLink(
    workspaceId: string,
    createdByUserId: string,
  ): Promise<{ shareLink: WorkspaceShareLinkSummary }> {
    return this.prisma.$transaction(async (tx) => {
      const db = toInvitationDatabase(tx);
      const { shareLink } = await this.getOrCreateWorkspaceShareLink(
        workspaceId,
        createdByUserId,
        db,
      );
      const token = createInvitationToken();
      const updatedShareLink = await db.workspaceShareLink.update({
        where: { id: shareLink.id },
        data: {
          tokenHash: createInvitationTokenHash(token),
          role: 'member',
          createdByUserId,
          expiresAt: this.createWorkspaceShareLinkExpiresAt(),
          revokedAt: null,
        },
        select: workspaceShareLinkSummarySelect,
      });

      return {
        shareLink: this.toWorkspaceShareLinkSummary(updatedShareLink, token),
      };
    });
  }

  async disableWorkspaceShareLink(
    workspaceId: string,
    createdByUserId: string,
  ): Promise<{ shareLink: WorkspaceShareLinkSummary }> {
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const db = toInvitationDatabase(tx);
        const { shareLink } = await this.getOrCreateWorkspaceShareLink(
          workspaceId,
          createdByUserId,
          db,
        );
        const disabledShareLink = await db.workspaceShareLink.update({
          where: { id: shareLink.id },
          data: { revokedAt: new Date() },
          select: workspaceShareLinkSummarySelect,
        });

        return {
          shareLink: this.toWorkspaceShareLinkSummary(disabledShareLink),
        };
      });

      this.securityTelemetryService.record({
        category: 'destructive',
        eventName: 'share_link.disable',
        outcome: 'success',
        workspaceId,
        actorUserId: createdByUserId,
      });

      return result;
    } catch (error) {
      this.securityTelemetryService.record({
        category: 'destructive',
        eventName: 'share_link.disable',
        outcome: 'failure',
        workspaceId,
        actorUserId: createdByUserId,
        details: {
          reason: error instanceof Error ? error.message : 'unknown_error',
        },
      });
      throw error;
    }
  }

  async acceptInvitation(
    invitationId: string,
    user: Pick<RequestUser, 'id' | 'email'>,
  ): Promise<{ membership: ReturnType<MembershipsService['toDetail']> }> {
    return this.acceptInvitationWithLookup({ invitationId }, user);
  }

  async acceptInvitationByToken(
    token: string,
    user: Pick<RequestUser, 'id' | 'email'>,
    auditContext: SecurityAuditContext = {},
  ): Promise<{ membership: ReturnType<MembershipsService['toDetail']> }> {
    const normalizedToken = normalizePublicToken(token);

    if (!normalizedToken) {
      this.auditSecurityEvent('invitation.accept', 'failure', {
        ...auditContext,
        actorUserId: user.id,
        reason: 'invalid_token_format',
      });
      throw new NotFoundException('Invitation not found.');
    }

    try {
      const result = await this.acceptInvitationWithLookup({ token: normalizedToken }, user);
      this.auditSecurityEvent('invitation.accept', 'success', {
        ...auditContext,
        actorUserId: user.id,
        workspaceId: result.membership.workspaceId,
      });
      return result;
    } catch (error) {
      this.auditSecurityEvent('invitation.accept', 'failure', {
        ...auditContext,
        actorUserId: user.id,
        reason: error instanceof Error ? error.message : 'unknown_error',
      });
      throw error;
    }
  }

  async getWorkspaceShareLinkByToken(
    token: string,
    auditContext: SecurityAuditContext = {},
  ): Promise<PublicWorkspaceShareLinkLookup> {
    const normalizedToken = normalizePublicToken(token);

    if (!normalizedToken) {
      this.auditSecurityEvent('share_link.lookup', 'failure', {
        ...auditContext,
        reason: 'invalid_token_format',
      });
      throw new NotFoundException('Workspace share link not found.');
    }

    const shareLink = await toInvitationDatabase(this.prisma).workspaceShareLink.findFirst({
      where: {
        tokenHash: createInvitationTokenHash(normalizedToken),
      },
      select: workspaceShareLinkWithWorkspaceSelect,
    });

    if (!shareLink) {
      this.auditSecurityEvent('share_link.lookup', 'failure', {
        ...auditContext,
        reason: 'not_found',
      });
      throw new NotFoundException('Workspace share link not found.');
    }

    this.auditSecurityEvent('share_link.lookup', 'success', {
      ...auditContext,
      workspaceId: shareLink.workspaceId,
      shareLinkId: shareLink.id,
      status: this.toWorkspaceShareLinkStatus(shareLink),
    });

    return {
      shareLink: this.toPublicWorkspaceShareLinkSummary(shareLink),
      workspace: this.toWorkspaceSummary(shareLink.workspace),
      status: this.toWorkspaceShareLinkStatus(shareLink),
    };
  }

  async acceptWorkspaceShareLinkByToken(
    token: string,
    user: Pick<RequestUser, 'id' | 'email'>,
    auditContext: SecurityAuditContext = {},
  ): Promise<{ membership: ReturnType<MembershipsService['toDetail']> }> {
    const normalizedToken = normalizePublicToken(token);

    if (!normalizedToken) {
      this.auditSecurityEvent('share_link.accept', 'failure', {
        ...auditContext,
        actorUserId: user.id,
        reason: 'invalid_token_format',
      });
      throw new NotFoundException('Workspace share link not found.');
    }

    const shareLink = await toInvitationDatabase(this.prisma).workspaceShareLink.findFirst({
      where: {
        tokenHash: createInvitationTokenHash(normalizedToken),
      },
      select: workspaceShareLinkSummarySelect,
    });

    if (!shareLink) {
      this.auditSecurityEvent('share_link.accept', 'failure', {
        ...auditContext,
        actorUserId: user.id,
        reason: 'not_found',
      });
      throw new NotFoundException('Workspace share link not found.');
    }

    try {
      const result = await this.acceptWorkspaceShareLink(shareLink, user);
      this.auditSecurityEvent('share_link.accept', 'success', {
        ...auditContext,
        actorUserId: user.id,
        workspaceId: result.membership.workspaceId,
      });
      return result;
    } catch (error) {
      this.auditSecurityEvent('share_link.accept', 'failure', {
        ...auditContext,
        actorUserId: user.id,
        reason: error instanceof Error ? error.message : 'unknown_error',
      });
      throw error;
    }
  }

  private async acceptInvitationWithLookup(
    lookup: AcceptInvitationLookup,
    user: Pick<RequestUser, 'id' | 'email'>,
  ): Promise<{ membership: ReturnType<MembershipsService['toDetail']> }> {
    return this.prisma.$transaction(async (tx) => {
      const invitation = await this.findInvitationForAcceptance(lookup, tx);

      return this.acceptExistingInvitation(invitation, user, tx);
    });
  }

  private async acceptWorkspaceShareLink(
    shareLink: WorkspaceShareLinkSummaryRecord,
    user: Pick<RequestUser, 'id' | 'email'>,
  ): Promise<{ membership: ReturnType<MembershipsService['toDetail']> }> {
    if (shareLink.role !== 'member') {
      throw new BadRequestException('Workspace share links can only grant member access.');
    }

    this.assertWorkspaceShareLinkIsActive(shareLink);

    return this.prisma.$transaction(async (tx) => {
      const existingMembership = await tx.workspaceMembership.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: shareLink.workspaceId,
            userId: user.id,
          },
        },
      });

      if (existingMembership) {
        throw new ConflictException('You are already a member of this workspace.');
      }

      const createdMembership = await this.membershipsService.createMembership(
        {
          workspaceId: shareLink.workspaceId,
          userId: user.id,
          role: 'member',
        },
        tx,
      );

      await tx.workspaceShareLink.update({
        where: { id: shareLink.id },
        data: { lastUsedAt: new Date() },
        select: workspaceShareLinkSummarySelect,
      });

      const currentUser = await this.usersService.getByIdOrThrow(user.id, tx);

      return {
        membership: this.membershipsService.toDetail(createdMembership, currentUser),
      };
    });
  }

  toSummary(
    invitation: Pick<
      WorkspaceInvitation,
      | 'id'
      | 'workspaceId'
      | 'email'
      | 'role'
      | 'invitedByUserId'
      | 'expiresAt'
      | 'createdAt'
      | 'acceptedAt'
      | 'revokedAt'
    >,
  ): WorkspaceInvitationSummary {
    return {
      id: invitation.id,
      workspaceId: invitation.workspaceId,
      email: invitation.email,
      role: invitation.role,
      invitedByUserId: invitation.invitedByUserId,
      expiresAt: invitation.expiresAt.toISOString(),
      createdAt: invitation.createdAt.toISOString(),
      acceptedAt: invitation.acceptedAt?.toISOString() ?? null,
      revokedAt: invitation.revokedAt?.toISOString() ?? null,
    };
  }

  private toPublicSummary(
    invitation: Pick<
      WorkspaceInvitation,
      'id' | 'workspaceId' | 'role' | 'expiresAt' | 'createdAt' | 'acceptedAt' | 'revokedAt'
    >,
  ): PublicWorkspaceInvitationSummary {
    return {
      id: invitation.id,
      workspaceId: invitation.workspaceId,
      role: invitation.role,
      expiresAt: invitation.expiresAt.toISOString(),
      createdAt: invitation.createdAt.toISOString(),
      acceptedAt: invitation.acceptedAt?.toISOString() ?? null,
      revokedAt: invitation.revokedAt?.toISOString() ?? null,
    };
  }

  private toWorkspaceShareLinkSummary(
    shareLink: Pick<
      WorkspaceShareLink,
      | 'id'
      | 'workspaceId'
      | 'role'
      | 'createdByUserId'
      | 'expiresAt'
      | 'revokedAt'
      | 'lastUsedAt'
      | 'createdAt'
      | 'updatedAt'
    >,
    token?: string,
  ): WorkspaceShareLinkSummary {
    return {
      id: shareLink.id,
      workspaceId: shareLink.workspaceId,
      role: shareLink.role,
      createdByUserId: shareLink.createdByUserId,
      expiresAt: shareLink.expiresAt.toISOString(),
      revokedAt: shareLink.revokedAt?.toISOString() ?? null,
      lastUsedAt: shareLink.lastUsedAt?.toISOString() ?? null,
      createdAt: shareLink.createdAt.toISOString(),
      updatedAt: shareLink.updatedAt.toISOString(),
      status: this.toWorkspaceShareLinkStatus(shareLink),
      url: token ? this.buildWorkspaceShareUrl(token) : null,
    };
  }

  private toPublicWorkspaceShareLinkSummary(
    shareLink: Pick<
      WorkspaceShareLink,
      'id' | 'workspaceId' | 'role' | 'expiresAt' | 'revokedAt' | 'lastUsedAt' | 'createdAt' | 'updatedAt'
    >,
  ): PublicWorkspaceShareLinkSummary {
    return {
      id: shareLink.id,
      workspaceId: shareLink.workspaceId,
      role: shareLink.role,
      expiresAt: shareLink.expiresAt.toISOString(),
      revokedAt: shareLink.revokedAt?.toISOString() ?? null,
      lastUsedAt: shareLink.lastUsedAt?.toISOString() ?? null,
      createdAt: shareLink.createdAt.toISOString(),
      updatedAt: shareLink.updatedAt.toISOString(),
    };
  }

  private async createInvitation(
    input: {
      workspaceId: string;
      email: string;
      token: string;
      role: WorkspaceRole;
      invitedByUserId: string;
    },
    db: InvitationDatabase,
  ): Promise<InvitationSummaryRecord> {
    const expiresAt = this.createInvitationExpiresAt();

    try {
      return await db.workspaceInvitation.create({
        data: {
          workspaceId: input.workspaceId,
          email: input.email,
          tokenHash: createInvitationTokenHash(input.token),
          expiresAt,
          role: input.role,
          invitedByUserId: input.invitedByUserId,
        },
        select: invitationSummarySelect,
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException('There is already a pending invitation for this email.');
      }

      throw error;
    }
  }

  private async getOrCreateWorkspaceShareLink(
    workspaceId: string,
    createdByUserId: string,
    db: InvitationDatabase,
  ): Promise<{ shareLink: WorkspaceShareLinkSummaryRecord; token?: string }> {
    const token = createInvitationToken();
    const createResult = await db.workspaceShareLink.createMany({
      data: [
        {
          workspaceId,
          tokenHash: createInvitationTokenHash(token),
          role: 'member',
          createdByUserId,
          expiresAt: this.createWorkspaceShareLinkExpiresAt(),
        },
      ],
      skipDuplicates: true,
    });
    const shareLink = await db.workspaceShareLink.findUnique({
      where: {
        workspaceId,
      },
      select: workspaceShareLinkSummarySelect,
    });

    if (!shareLink) {
      throw new NotFoundException('Workspace share link unavailable.');
    }

    return createResult.count > 0 ? { shareLink, token } : { shareLink };
  }

  private async ensureNoActiveInvitation(
    workspaceId: string,
    email: string,
    db: InvitationDatabase,
  ): Promise<void> {
    const existingInvitation = await db.workspaceInvitation.findFirst({
      where: {
        workspaceId,
        email,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      select: { id: true },
    });

    if (existingInvitation) {
      throw new ConflictException('There is already a pending invitation for this email.');
    }
  }

  private async revokeExpiredPendingInvitations(
    workspaceId: string,
    email: string,
    db: InvitationDatabase,
  ): Promise<void> {
    const now = new Date();

    await db.workspaceInvitation.updateMany({
      where: {
        workspaceId,
        email,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: {
          lte: now,
        },
      },
      data: {
        revokedAt: now,
      },
    });
  }

  private toWorkspaceSummary(workspace: WorkspaceSummaryRecord): WorkspaceSummary {
    return {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      createdByUserId: workspace.createdByUserId,
      createdAt: workspace.createdAt.toISOString(),
      updatedAt: workspace.updatedAt.toISOString(),
    };
  }

  private buildInviteUrl(token: string): string {
    const inviteBaseUrl =
      this.configService.get<string>('INVITE_BASE_URL') ??
      this.configService.get<string>('APP_URL') ??
      'http://localhost:3000';

    return new URL(`/invite/${encodeURIComponent(token)}`, inviteBaseUrl).toString();
  }

  private buildWorkspaceShareUrl(token: string): string {
    const inviteBaseUrl =
      this.configService.get<string>('INVITE_BASE_URL') ??
      this.configService.get<string>('APP_URL') ??
      'http://localhost:3000';

    return new URL(`/join/${encodeURIComponent(token)}`, inviteBaseUrl).toString();
  }

  private createInvitationExpiresAt(from = new Date()): Date {
    const inviteTtlDays = this.configService.get<number>('INVITE_TTL_DAYS') ?? 30;
    return new Date(from.getTime() + inviteTtlDays * MILLISECONDS_PER_DAY);
  }

  private createWorkspaceShareLinkExpiresAt(from = new Date()): Date {
    const shareLinkTtlDays = this.configService.get<number>('SHARE_LINK_TTL_DAYS') ?? 14;
    return new Date(from.getTime() + shareLinkTtlDays * MILLISECONDS_PER_DAY);
  }

  private toPublicStatus(
    invitation: Pick<WorkspaceInvitation, 'acceptedAt' | 'revokedAt' | 'expiresAt'>,
  ): PublicWorkspaceInvitationStatus {
    if (invitation.acceptedAt) {
      return 'accepted';
    }

    if (invitation.revokedAt) {
      return 'revoked';
    }

    if (invitation.expiresAt.getTime() <= Date.now()) {
      return 'expired';
    }

    return 'pending';
  }

  private toWorkspaceShareLinkStatus(
    shareLink: Pick<WorkspaceShareLink, 'expiresAt' | 'revokedAt'>,
  ): WorkspaceShareLinkStatus {
    if (shareLink.revokedAt) {
      return 'revoked';
    }

    if (shareLink.expiresAt.getTime() <= Date.now()) {
      return 'expired';
    }

    return 'active';
  }

  private async findInvitationForAcceptance(
    lookup: AcceptInvitationLookup,
    tx: Prisma.TransactionClient,
  ): Promise<InvitationSummaryRecord | null> {
    if ('token' in lookup) {
      return tx.workspaceInvitation.findUnique({
        where: {
          tokenHash: createInvitationTokenHash(lookup.token),
        },
        select: invitationSummarySelect,
      });
    }

    return tx.workspaceInvitation.findUnique({
      where: {
        id: lookup.invitationId,
      },
      select: invitationSummarySelect,
    });
  }

  private async acceptExistingInvitation(
    invitation: InvitationSummaryRecord | null,
    user: Pick<RequestUser, 'id' | 'email'>,
    tx: Prisma.TransactionClient,
  ): Promise<{ membership: ReturnType<MembershipsService['toDetail']> }> {
    if (!invitation) {
      throw new NotFoundException('Invitation not found.');
    }

    this.assertInvitationCanBeAccepted(invitation);

    const normalizedEmail = normalizeEmail(user.email);
    if (invitation.email !== normalizedEmail) {
      throw new ForbiddenException(
        'You cannot accept an invitation for a different email address.',
      );
    }

    const existingMembership = await tx.workspaceMembership.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: invitation.workspaceId,
          userId: user.id,
        },
      },
    });

    if (existingMembership) {
      throw new ConflictException('You are already a member of this workspace.');
    }

    const createdMembership = await this.membershipsService.createMembership(
      {
        workspaceId: invitation.workspaceId,
        userId: user.id,
        role: invitation.role,
      },
      tx,
    );

    const acceptedAt = new Date();
    const updateResult = await tx.workspaceInvitation.updateMany({
      where: {
        id: invitation.id,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: {
          gt: acceptedAt,
        },
      },
      data: { acceptedAt },
    });

    if (updateResult.count !== 1) {
      throw new ConflictException('Invitation has already been accepted.');
    }

    const currentUser = await this.usersService.getByIdOrThrow(user.id, tx);

    return {
      membership: this.membershipsService.toDetail(createdMembership, currentUser),
    };
  }

  private assertInvitationCanBeAccepted(
    invitation: Pick<WorkspaceInvitation, 'acceptedAt' | 'revokedAt' | 'expiresAt'>,
  ): void {
    if (invitation.acceptedAt) {
      throw new ConflictException('Invitation has already been accepted.');
    }

    if (invitation.revokedAt) {
      throw new ConflictException('Invitation has been revoked.');
    }

    if (invitation.expiresAt.getTime() <= Date.now()) {
      throw new ConflictException('Invitation has expired.');
    }
  }

  private assertWorkspaceShareLinkIsActive(
    shareLink: Pick<WorkspaceShareLink, 'expiresAt' | 'revokedAt'>,
  ): void {
    if (shareLink.revokedAt) {
      throw new ConflictException('Workspace share link has been disabled.');
    }

    if (shareLink.expiresAt.getTime() <= Date.now()) {
      throw new ConflictException('Workspace share link has expired.');
    }
  }

  private auditSecurityEvent(
    eventName: string,
    outcome: 'success' | 'failure',
    details: Record<string, unknown>,
  ): void {
    this.securityTelemetryService.record({
      category: 'invitation',
      eventName,
      outcome,
      ...(typeof details['workspaceId'] === 'string'
        ? { workspaceId: details['workspaceId'] }
        : {}),
      ...(typeof details['actorUserId'] === 'string'
        ? { actorUserId: details['actorUserId'] }
        : {}),
      ...(typeof details['ipAddress'] === 'string' || details['ipAddress'] === null
        ? { ipAddress: details['ipAddress'] as string | null }
        : {}),
      ...(typeof details['userAgent'] === 'string' || details['userAgent'] === null
        ? { userAgent: details['userAgent'] as string | null }
        : {}),
      details,
    });
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return isPrismaErrorCode(error, 'P2002');
}

function createInvitationToken(): string {
  return randomBytes(32).toString('hex');
}

function createInvitationTokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function normalizePublicToken(token: string): string | null {
  const normalizedToken = token.trim();

  if (!INVITE_TOKEN_PATTERN.test(normalizedToken)) {
    return null;
  }

  return normalizedToken;
}
