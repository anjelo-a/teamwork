import { readWorkspaceIdFromParams } from '@/lib/route-params';
import { WorkspaceBoardPageClient } from './workspace-board-page-client';

export const preferredRegion = 'sin1';

interface WorkspaceBoardPageProps {
  params: Promise<{
    workspaceId: string;
  }>;
}

export default async function WorkspaceBoardPage({
  params,
}: WorkspaceBoardPageProps) {
  const resolvedParams = await params;
  const workspaceId = readWorkspaceIdFromParams(resolvedParams);

  return (
    <WorkspaceBoardPageClient
      workspaceId={workspaceId}
      initialBoardData={null}
    />
  );
}
