import type {
  AuthMeResponse,
  CreateTaskInput,
  TaskDeleteResponse,
  TaskListResponse,
  TaskResponse,
  TaskAssignmentFilter,
  UpdateTaskAssigneeInput,
  UpdateTaskInput,
  UpdateTaskStatusInput,
  WorkspaceMemberResponse,
  WorkspaceInvitationsResponse,
  WorkspaceMembersResponse,
  WorkspaceResponse,
} from '@teamwork/types';
import {
  parseAuthMeResponse,
  parseWorkspaceMemberResponse,
  parseTaskListResponse,
  parseTaskResponse,
  parseWorkspaceInvitationsResponse,
  parseWorkspaceMembersResponse,
  parseWorkspaceResponse,
} from '@/lib/api/contracts';

interface ApiRequestOptions<T> {
  accessToken: string;
  parser: (value: unknown) => T;
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: string;
}

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export async function getAuthMe(accessToken: string): Promise<AuthMeResponse> {
  return apiRequest('/auth/me', {
    accessToken,
    parser: parseAuthMeResponse,
  });
}

export async function getWorkspaceDetails(
  workspaceId: string,
  accessToken: string,
): Promise<WorkspaceResponse> {
  return apiRequest(`/workspaces/${workspaceId}`, {
    accessToken,
    parser: parseWorkspaceResponse,
  });
}

export async function getWorkspaceMembers(
  workspaceId: string,
  accessToken: string,
): Promise<WorkspaceMembersResponse> {
  return apiRequest(`/workspaces/${workspaceId}/members`, {
    accessToken,
    parser: parseWorkspaceMembersResponse,
  });
}

export async function updateWorkspaceMemberRole(
  workspaceId: string,
  userId: string,
  accessToken: string,
  role: 'owner' | 'member',
): Promise<WorkspaceMemberResponse> {
  return apiRequest(`/workspaces/${workspaceId}/members/${userId}`, {
    accessToken,
    method: 'PATCH',
    body: JSON.stringify({ role }),
    parser: parseWorkspaceMemberResponse,
  });
}

export async function getWorkspaceInvitations(
  workspaceId: string,
  accessToken: string,
): Promise<WorkspaceInvitationsResponse> {
  return apiRequest(`/workspaces/${workspaceId}/invitations`, {
    accessToken,
    parser: parseWorkspaceInvitationsResponse,
  });
}

export async function listInboxTasks(accessToken: string): Promise<TaskListResponse> {
  return apiRequest('/tasks', {
    accessToken,
    parser: parseTaskListResponse,
  });
}

export async function listWorkspaceTasks(
  workspaceId: string,
  accessToken: string,
  filters?: {
    assignment?: TaskAssignmentFilter;
  },
): Promise<TaskListResponse> {
  const searchParams = new URLSearchParams();

  if (filters?.assignment) {
    searchParams.set('assignment', filters.assignment);
  }

  const queryString = searchParams.toString();
  const path = queryString
    ? `/workspaces/${workspaceId}/tasks?${queryString}`
    : `/workspaces/${workspaceId}/tasks`;

  return apiRequest(path, {
    accessToken,
    parser: parseTaskListResponse,
  });
}

export async function createWorkspaceTask(
  workspaceId: string,
  accessToken: string,
  input: CreateTaskInput,
): Promise<TaskResponse> {
  return apiRequest(`/workspaces/${workspaceId}/tasks`, {
    accessToken,
    method: 'POST',
    body: JSON.stringify(input),
    parser: parseTaskResponse,
  });
}

export async function getWorkspaceTaskDetails(
  workspaceId: string,
  taskId: string,
  accessToken: string,
): Promise<TaskResponse> {
  return apiRequest(`/workspaces/${workspaceId}/tasks/${taskId}`, {
    accessToken,
    parser: parseTaskResponse,
  });
}

export async function updateWorkspaceTask(
  workspaceId: string,
  taskId: string,
  accessToken: string,
  input: UpdateTaskInput,
): Promise<TaskResponse> {
  return apiRequest(`/workspaces/${workspaceId}/tasks/${taskId}`, {
    accessToken,
    method: 'PATCH',
    body: JSON.stringify(input),
    parser: parseTaskResponse,
  });
}

export async function updateWorkspaceTaskStatus(
  workspaceId: string,
  taskId: string,
  accessToken: string,
  input: UpdateTaskStatusInput,
): Promise<TaskResponse> {
  return apiRequest(`/workspaces/${workspaceId}/tasks/${taskId}/status`, {
    accessToken,
    method: 'PATCH',
    body: JSON.stringify(input),
    parser: parseTaskResponse,
  });
}

export async function updateWorkspaceTaskAssignee(
  workspaceId: string,
  taskId: string,
  accessToken: string,
  input: UpdateTaskAssigneeInput,
): Promise<TaskResponse> {
  return apiRequest(`/workspaces/${workspaceId}/tasks/${taskId}/assignee`, {
    accessToken,
    method: 'PATCH',
    body: JSON.stringify(input),
    parser: parseTaskResponse,
  });
}

export async function deleteWorkspaceTask(
  workspaceId: string,
  taskId: string,
  accessToken: string,
): Promise<TaskDeleteResponse> {
  return apiRequest(`/workspaces/${workspaceId}/tasks/${taskId}`, {
    accessToken,
    method: 'DELETE',
    parser: parseTaskDeleteResponse,
  });
}

async function apiRequest<T>(path: string, options: ApiRequestOptions<T>): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${options.accessToken}`,
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options.body ?? null,
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new ApiError(await readErrorMessage(response), response.status);
  }

  const data: unknown = await response.json();
  return options.parser(data);
}

function parseTaskDeleteResponse(value: unknown): TaskDeleteResponse {
  if (isRecord(value) && value['success'] === true) {
    return { success: true };
  }

  throw new Error('Expected task delete response.');
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const data: unknown = await response.json();

    if (isRecord(data) && 'message' in data) {
      const message = data['message'];

      if (typeof message === 'string') {
        return message;
      }

      if (Array.isArray(message) && message.every((entry) => typeof entry === 'string')) {
        const firstMessage = message[0];

        if (firstMessage) {
          return firstMessage;
        }
      }
    }
  } catch {
    return response.statusText || 'Request failed.';
  }

  return response.statusText || 'Request failed.';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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
