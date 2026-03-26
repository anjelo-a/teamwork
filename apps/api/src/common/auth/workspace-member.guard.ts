import { CanActivate, ExecutionContext, Injectable, NotFoundException } from '@nestjs/common';
import { MembershipsService } from '../../memberships/memberships.service';
import type { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';

@Injectable()
export class WorkspaceMemberGuard implements CanActivate {
  constructor(private readonly membershipsService: MembershipsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const rawWorkspaceId = request.params['workspaceId'];
    const workspaceId = Array.isArray(rawWorkspaceId) ? rawWorkspaceId[0] : rawWorkspaceId;

    if (!workspaceId) {
      throw new NotFoundException('workspaceId route parameter is required');
    }

    request.workspaceMembership = await this.membershipsService.requireMembership(
      workspaceId,
      request.user.id,
    );

    return true;
  }
}
