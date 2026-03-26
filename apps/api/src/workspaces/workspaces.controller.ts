import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { WorkspaceMemberGuard } from '../common/auth/workspace-member.guard';
import { WorkspaceRoleGuard } from '../common/auth/workspace-role.guard';
import { WorkspaceRoles } from '../common/auth/workspace-roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/interfaces/request-user.interface';
import { MembershipsService } from '../memberships/memberships.service';
import { WorkspaceInvitationsService } from '../workspace-invitations/workspace-invitations.service';
import { AddWorkspaceMemberDto } from './dto/add-workspace-member.dto';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceMemberDto } from './dto/update-workspace-member.dto';
import { WorkspacesService } from './workspaces.service';

@Controller('workspaces')
@UseGuards(JwtAuthGuard)
export class WorkspacesController {
  constructor(
    private readonly workspacesService: WorkspacesService,
    private readonly membershipsService: MembershipsService,
    private readonly workspaceInvitationsService: WorkspaceInvitationsService,
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

  @Get(':workspaceId/members')
  @UseGuards(WorkspaceMemberGuard)
  async listMembers(@Param('workspaceId', ParseUUIDPipe) workspaceId: string) {
    return {
      members: await this.membershipsService.listWorkspaceMembers(workspaceId),
    };
  }

  @Get(':workspaceId/invitations')
  @UseGuards(WorkspaceMemberGuard, WorkspaceRoleGuard)
  @WorkspaceRoles('owner')
  async listInvitations(@Param('workspaceId', ParseUUIDPipe) workspaceId: string) {
    return {
      invitations: await this.workspaceInvitationsService.listPendingInvitations(workspaceId),
    };
  }

  @Post(':workspaceId/members')
  @UseGuards(WorkspaceMemberGuard, WorkspaceRoleGuard)
  @WorkspaceRoles('owner')
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
  @UseGuards(WorkspaceMemberGuard, WorkspaceRoleGuard)
  @WorkspaceRoles('owner')
  async updateMemberRole(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateWorkspaceMemberDto,
  ) {
    return {
      membership: await this.membershipsService.updateMemberRole(workspaceId, userId, dto.role),
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
  @UseGuards(WorkspaceMemberGuard, WorkspaceRoleGuard)
  @WorkspaceRoles('owner')
  async revokeInvitation(
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('invitationId', ParseUUIDPipe) invitationId: string,
  ) {
    return this.workspaceInvitationsService.revokeInvitation(workspaceId, invitationId);
  }
}
