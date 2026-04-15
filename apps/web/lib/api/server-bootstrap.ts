import 'server-only';

import { cookies } from 'next/headers';
import type { WorkspaceBoardDataResponse } from '@teamwork/types';
import { parseWorkspaceBoardDataResponse } from '@/lib/api/contracts';

const SERVER_ACCESS_TOKEN_COOKIE_NAMES = ['teamwork.at', 'teamwork.accessToken'] as const;

export async function loadInitialWorkspaceBoardData(
  workspaceId: string,
): Promise<WorkspaceBoardDataResponse | null> {
  const accessToken = await readServerAccessToken();

  if (!accessToken) {
    return null;
  }

  try {
    const response = await fetch(`${getApiBaseUrl()}/workspaces/${workspaceId}/board-data`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      return null;
    }

    const payload: unknown = await response.json();
    return parseWorkspaceBoardDataResponse(payload);
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Failed to load initial workspace board data.', error);
    }

    return null;
  }
}

async function readServerAccessToken(): Promise<string | null> {
  const cookieStore = await cookies();

  for (const cookieName of SERVER_ACCESS_TOKEN_COOKIE_NAMES) {
    const rawValue = cookieStore.get(cookieName)?.value.trim();

    if (rawValue && rawValue.length > 0) {
      return rawValue;
    }
  }

  return null;
}

function getApiBaseUrl(): string {
  const configuredBaseUrl = process.env['NEXT_PUBLIC_API_BASE_URL']?.trim();

  if (configuredBaseUrl) {
    return configuredBaseUrl.endsWith('/')
      ? configuredBaseUrl.slice(0, -1)
      : configuredBaseUrl;
  }

  return 'http://localhost:3000';
}
