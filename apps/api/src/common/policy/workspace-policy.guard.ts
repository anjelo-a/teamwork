import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';
import {
  WORKSPACE_POLICY_ACTIONS_KEY,
} from './workspace-policy.decorator';
import type { WorkspacePolicyAction } from './workspace-policy.service';
import { WorkspacePolicyService } from './workspace-policy.service';

@Injectable()
export class WorkspacePolicyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly workspacePolicyService: WorkspacePolicyService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const actions = this.reflector.getAllAndOverride<WorkspacePolicyAction[] | undefined>(
      WORKSPACE_POLICY_ACTIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!actions || actions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    for (const action of actions) {
      this.workspacePolicyService.assertCanPerformAction(action, request.workspaceMembership);
    }

    return true;
  }
}
