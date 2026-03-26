import { Module } from '@nestjs/common';
import { MembershipsModule } from '../memberships/memberships.module';
import { WorkspaceInvitationsModule } from '../workspace-invitations/workspace-invitations.module';
import { WorkspacesController } from './workspaces.controller';
import { WorkspacesService } from './workspaces.service';

@Module({
  imports: [MembershipsModule, WorkspaceInvitationsModule],
  controllers: [WorkspacesController],
  providers: [WorkspacesService],
  exports: [WorkspacesService],
})
export class WorkspacesModule {}
