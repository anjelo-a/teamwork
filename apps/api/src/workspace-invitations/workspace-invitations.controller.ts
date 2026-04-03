import { Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import type {
  PublicWorkspaceInvitationLookup,
  WorkspaceInvitationSummary,
  WorkspaceMemberDetail,
  WorkspaceSummary,
} from '@teamwork/types';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { RequestUser } from '../common/interfaces/request-user.interface';
import { WorkspaceInvitationsService } from './workspace-invitations.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class WorkspaceInvitationsController {
  constructor(private readonly workspaceInvitationsService: WorkspaceInvitationsService) {}

  @Public()
  @Get('workspace-invitations/token/:token')
  async getInvitationByToken(
    @Param('token') token: string,
  ): Promise<PublicWorkspaceInvitationLookup> {
    return this.workspaceInvitationsService.getInvitationByToken(token);
  }

  @Get('users/me/invitations')
  async listMyInvitations(@CurrentUser() user: RequestUser): Promise<{
    invitations: Array<{
      invitation: WorkspaceInvitationSummary;
      workspace: WorkspaceSummary;
    }>;
  }> {
    return {
      invitations: await this.workspaceInvitationsService.listPendingInvitationsForEmail(
        user.email,
      ),
    };
  }

  @Post('workspaces/invitations/:invitationId/accept')
  async acceptInvitation(
    @CurrentUser() user: RequestUser,
    @Param('invitationId', ParseUUIDPipe) invitationId: string,
  ): Promise<{ membership: WorkspaceMemberDetail }> {
    return this.workspaceInvitationsService.acceptInvitation(invitationId, user);
  }
}
