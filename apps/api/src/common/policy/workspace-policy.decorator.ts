import { SetMetadata } from '@nestjs/common';
import type { WorkspacePolicyAction } from './workspace-policy.service';

export const WORKSPACE_POLICY_ACTIONS_KEY = 'workspacePolicyActions';

export const WorkspacePolicy = (...actions: WorkspacePolicyAction[]) =>
  SetMetadata(WORKSPACE_POLICY_ACTIONS_KEY, actions);
