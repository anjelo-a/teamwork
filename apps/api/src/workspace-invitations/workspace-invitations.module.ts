import { Module } from '@nestjs/common';
import { MembershipsModule } from '../memberships/memberships.module';
import { UsersModule } from '../users/users.module';
import { WorkspaceInvitationsController } from './workspace-invitations.controller';
import { WorkspaceInvitationsService } from './workspace-invitations.service';

@Module({
  imports: [MembershipsModule, UsersModule],
  controllers: [WorkspaceInvitationsController],
  providers: [WorkspaceInvitationsService],
  exports: [WorkspaceInvitationsService],
})
export class WorkspaceInvitationsModule {}
