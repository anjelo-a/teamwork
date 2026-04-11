import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { WorkspaceBoardDataResponse, WorkspaceSecurityDashboard } from '@teamwork/types';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { WorkspaceMemberGuard } from '../common/auth/workspace-member.guard';
import { WorkspacePolicy } from '../common/policy/workspace-policy.decorator';
import { WorkspacePolicyGuard } from '../common/policy/workspace-policy.guard';
import { SecurityTelemetryService } from '../common/security/security-telemetry.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/interfaces/request-user.interface';
import { MembershipsService } from '../memberships/memberships.service';
import { WorkspaceInvitationsService } from '../workspace-invitations/workspace-invitations.service';
import { AddWorkspaceMemberDto } from './dto/add-workspace-member.dto';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { TransferWorkspaceOwnershipDto } from './dto/transfer-workspace-ownership.dto';
import { UpdateWorkspaceMemberDto } from './dto/update-workspace-member.dto';
import { WorkspaceBoardFiltersDto } from './dto/workspace-board-filters.dto';
import { UpdateWorkspaceShareLinkDto } from './dto/update-workspace-share-link.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { WorkspacesService } from './workspaces.service';

@Controller('workspaces')
@UseGuards(JwtAuthGuard)
export class WorkspacesController {
  constructor(
    private readonly workspacesService: WorkspacesService,
    private readonly membershipsService: MembershipsService,
    private readonly workspaceInvitationsService: WorkspaceInvitationsService,
    private readonly securityTelemetryService: SecurityTelemetryService,
  ) {}

  @Get()
  async listWorkspaces(@CurrentUser() user: RequestUser) {
    return {
      workspaces: await this.workspacesService.listForUser(user.id),
    };
  }

  @Post()
  async createWorkspace(@CurrentUser() user: RequestUser, @Body() dto: CreateWorkspaceDto) {
    return {
      workspace: await this.workspacesService.createWorkspaceForUser(dto.name, user.id),
    };
  }

  @Get(':workspaceId')
  @UseGuards(WorkspaceMemberGuard)
  async getWorkspace(
    @CurrentUser() user: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
  ) {
    return {
      workspace: await this.workspacesService.getWorkspaceForUser(workspaceId, user.id),
    };
  }

  @Patch(':workspaceId')
  @UseGuards(WorkspaceMemberGuard, WorkspacePolicyGuard)
  @WorkspacePolicy('workspace.settings.update')
  async updateWorkspace(
    @CurrentUser() user: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body() dto: UpdateWorkspaceDto,
  ) {
    return {
      workspace: await this.workspacesService.updateWorkspaceName(workspaceId, dto.name, user.id),
    };
  }

  @Get(':workspaceId/board-data')
  @UseGuards(WorkspaceMemberGuard)
  async getWorkspaceBoardData(
    @CurrentUser() user: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Query() filters: WorkspaceBoardFiltersDto,
  ): Promise<WorkspaceBoardDataResponse> {
    const { workspaceId: requestedWorkspaceId, includeMembers, ...taskFilters } = filters;

    if (requestedWorkspaceId && requestedWorkspaceId !== workspaceId) {
      throw new BadRequestException('workspaceId query param must match the route workspaceId.');
    }

    return this.workspacesService.getWorkspaceBoardDataForUser({
      workspaceId,
      currentUserId: user.id,
      ...(includeMembers !== undefined ? { includeMembers } : {}),
      ...taskFilters,
    });
  }

  @Delete(':workspaceId')
  @UseGuards(WorkspaceMemberGuard, WorkspacePolicyGuard)
  @WorkspacePolicy('workspace.delete')
  async deleteWorkspace(
    @CurrentUser() user: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
  ) {
    return this.workspacesService.deleteWorkspace(workspaceId, user.id);
  }

  @Get(':workspaceId/members')
  @UseGuards(WorkspaceMemberGuard)
  async listMembers(@Param('workspaceId', ParseUUIDPipe) workspaceId: string) {
    return {
      members: await this.membershipsService.listWorkspaceMembers(workspaceId),
    };
  }

  @Get(':workspaceId/invitations')
  @UseGuards(WorkspaceMemberGuard, WorkspacePolicyGuard)
  @WorkspacePolicy('workspace.invitations.manage')
  async listInvitations(@Param('workspaceId', ParseUUIDPipe) workspaceId: string) {
    return {
      invitations: await this.workspaceInvitationsService.listPendingInvitations(workspaceId),
    };
  }

  @Get(':workspaceId/share-link')
  @UseGuards(WorkspaceMemberGuard, WorkspacePolicyGuard)
  @WorkspacePolicy('workspace.invitations.manage')
  async getWorkspaceShareLink(
    @CurrentUser() user: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
  ) {
    return this.workspaceInvitationsService.getWorkspaceShareLink(workspaceId, user.id);
  }

  @Post(':workspaceId/members')
  @UseGuards(WorkspaceMemberGuard, WorkspacePolicyGuard)
  @WorkspacePolicy('workspace.invitations.manage')
  async addMember(
    @CurrentUser() user: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body() dto: AddWorkspaceMemberDto,
  ) {
    return this.workspaceInvitationsService.inviteMember(
      workspaceId,
      dto.email,
      dto.role ?? 'member',
      user.id,
    );
  }

  @Patch(':workspaceId/members/:userId')
  @UseGuards(WorkspaceMemberGuard, WorkspacePolicyGuard)
  @WorkspacePolicy('workspace.members.manage')
  async updateMemberRole(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateWorkspaceMemberDto,
  ) {
    return {
      membership: await this.membershipsService.updateMemberRole(workspaceId, userId, dto.role),
    };
  }

  @Patch(':workspaceId/share-link')
  @UseGuards(WorkspaceMemberGuard, WorkspacePolicyGuard)
  @WorkspacePolicy('workspace.invitations.manage')
  async updateWorkspaceShareLink(
    @CurrentUser() user: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body() dto: UpdateWorkspaceShareLinkDto,
  ) {
    return this.workspaceInvitationsService.updateWorkspaceShareLink(
      workspaceId,
      dto.role,
      user.id,
    );
  }

  @Post(':workspaceId/share-link/regenerate')
  @UseGuards(WorkspaceMemberGuard, WorkspacePolicyGuard)
  @WorkspacePolicy('workspace.invitations.manage')
  async regenerateWorkspaceShareLink(
    @CurrentUser() user: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
  ) {
    return this.workspaceInvitationsService.regenerateWorkspaceShareLink(workspaceId, user.id);
  }

  @Delete(':workspaceId/share-link')
  @UseGuards(WorkspaceMemberGuard, WorkspacePolicyGuard)
  @WorkspacePolicy('workspace.invitations.manage')
  async disableWorkspaceShareLink(
    @CurrentUser() user: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
  ) {
    return this.workspaceInvitationsService.disableWorkspaceShareLink(workspaceId, user.id);
  }

  @Post(':workspaceId/ownership/transfer')
  @UseGuards(WorkspaceMemberGuard, WorkspacePolicyGuard)
  @WorkspacePolicy('workspace.ownership.transfer')
  async transferWorkspaceOwnership(
    @CurrentUser() user: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body() dto: TransferWorkspaceOwnershipDto,
  ) {
    return this.workspacesService.transferOwnership(workspaceId, user.id, dto.nextOwnerUserId);
  }

  @Post(':workspaceId/invitations/revoke-all')
  @UseGuards(WorkspaceMemberGuard, WorkspacePolicyGuard)
  @WorkspacePolicy('workspace.invitations.manage')
  async revokeAllInvitations(
    @CurrentUser() user: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
  ) {
    return this.workspaceInvitationsService.revokeAllPendingInvitations(workspaceId, user.id);
  }

  @Get(':workspaceId/security-dashboard')
  @UseGuards(WorkspaceMemberGuard, WorkspacePolicyGuard)
  @WorkspacePolicy('workspace.security.view')
  async getWorkspaceSecurityDashboard(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
  ): Promise<{ dashboard: WorkspaceSecurityDashboard }> {
    return {
      dashboard: this.securityTelemetryService.getWorkspaceDashboard({ workspaceId }),
    };
  }

  @Delete(':workspaceId/members/:userId')
  @UseGuards(WorkspaceMemberGuard)
  async removeMember(
    @CurrentUser() user: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.membershipsService.removeMember(workspaceId, userId, user.id);
  }

  @Delete(':workspaceId/invitations/:invitationId')
  @UseGuards(WorkspaceMemberGuard, WorkspacePolicyGuard)
  @WorkspacePolicy('workspace.invitations.manage')
  async revokeInvitation(
    @CurrentUser() user: RequestUser,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('invitationId', ParseUUIDPipe) invitationId: string,
  ) {
    return this.workspaceInvitationsService.revokeInvitation(workspaceId, invitationId, user.id);
  }
}
