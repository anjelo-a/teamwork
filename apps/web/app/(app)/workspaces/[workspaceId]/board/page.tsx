import type { WorkspaceBoardDataResponse } from '@teamwork/types';
import { readWorkspaceIdFromParams } from '@/lib/route-params';
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
  const initialBoardData = loadInitialBoardData(workspaceId);

  return (
    <WorkspaceBoardPageClient
      workspaceId={workspaceId}
      initialBoardData={initialBoardData}
    />
  );
}

function loadInitialBoardData(
  workspaceId: string,
): WorkspaceBoardDataResponse | null {
  void workspaceId;
  return null;
}
