import { readWorkspaceIdFromParams } from '@/lib/route-params';
import { loadInitialWorkspaceBoardData } from '@/lib/api/server-bootstrap';
import { WorkspaceBoardPageClient } from './workspace-board-page-client';

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
  const initialBoardData = await loadInitialWorkspaceBoardData(workspaceId);

  return (
    <WorkspaceBoardPageClient
      workspaceId={workspaceId}
      initialBoardData={initialBoardData}
    />
  );
}
