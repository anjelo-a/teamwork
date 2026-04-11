import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { WorkspaceRole } from '@teamwork/types';
import { WORKSPACE_ROLES_KEY } from './workspace-roles.decorator';
import type { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';
import { WorkspacePolicyService } from '../policy/workspace-policy.service';

@Injectable()
export class WorkspaceRoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly workspacePolicyService: WorkspacePolicyService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<WorkspaceRole[] | undefined>(
      WORKSPACE_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const membership = request.workspaceMembership;

    this.workspacePolicyService.assertHasAnyRole({
      membership,
      allowedRoles: requiredRoles,
      failureMessage: 'You do not have permission to perform this action in the workspace.',
    });

    return true;
  }
}
