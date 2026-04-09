import type { WorkspaceBoardDataResponse } from '@teamwork/types';
import { cookies } from 'next/headers';
import { ApiError, getWorkspaceBoardData } from '@/lib/api/client';
import { ACCESS_TOKEN_COOKIE_KEY } from '@/lib/auth/session-constants';
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
  const initialBoardData = await loadInitialBoardData(workspaceId);

  return (
    <WorkspaceBoardPageClient
      workspaceId={workspaceId}
      initialBoardData={initialBoardData}
    />
  );
}

async function loadInitialBoardData(
  workspaceId: string,
): Promise<WorkspaceBoardDataResponse | null> {
  const accessToken = (await cookies()).get(ACCESS_TOKEN_COOKIE_KEY)?.value ?? null;

  if (!accessToken) {
    return null;
  }

  try {
    return await getWorkspaceBoardData(workspaceId, accessToken, {
      includeMembers: false,
    });
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      return null;
    }

    return null;
  }
}
