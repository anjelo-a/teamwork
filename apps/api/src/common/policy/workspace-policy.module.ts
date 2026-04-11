import { Global, Module } from '@nestjs/common';
import { WorkspacePolicyGuard } from './workspace-policy.guard';
import { WorkspacePolicyService } from './workspace-policy.service';

@Global()
@Module({
  providers: [WorkspacePolicyService, WorkspacePolicyGuard],
  exports: [WorkspacePolicyService, WorkspacePolicyGuard],
})
export class WorkspacePolicyModule {}
