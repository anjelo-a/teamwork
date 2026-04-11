export type ID = string;

export type WorkspaceRole = 'owner' | 'member';
export type TaskStatus = 'todo' | 'in_progress' | 'done';
export type TaskDueBucket = 'past_due' | 'today' | 'upcoming' | 'no_date';
export type TaskAssignmentFilter = 'everyone' | 'me' | 'others' | 'unassigned';
export type WorkspaceShareLinkStatus = 'active' | 'revoked' | 'expired';

export interface UserSummary {
  id: ID;
  email: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceMembershipSummary {
  id: ID;
  workspaceId: ID;
  userId: ID;
  role: WorkspaceRole;
  createdAt: string;
}

export interface WorkspaceMemberDetail extends WorkspaceMembershipSummary {
  user: UserSummary;
}

export interface WorkspaceInvitationSummary {
  id: ID;
  workspaceId: ID;
  email: string;
  role: WorkspaceRole;
  invitedByUserId: ID;
  expiresAt: string;
  createdAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
}

export interface PublicWorkspaceInvitationSummary {
  id: ID;
  workspaceId: ID;
  role: WorkspaceRole;
  expiresAt: string;
  createdAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
}

export type PublicWorkspaceInvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired';

export interface PublicWorkspaceInvitationLookup {
  invitation: PublicWorkspaceInvitationSummary;
  workspace: WorkspaceSummary;
  status: PublicWorkspaceInvitationStatus;
}

export interface WorkspaceShareLinkSummary {
  id: ID;
  workspaceId: ID;
  role: WorkspaceRole;
  createdByUserId: ID;
  expiresAt: string;
  revokedAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
  status: WorkspaceShareLinkStatus;
  url: string | null;
}

export type SecurityTelemetryCategory = 'auth' | 'invitation' | 'destructive' | 'authorization';
export type SecurityTelemetryOutcome = 'success' | 'failure';
export type SecurityTelemetrySeverity = 'info' | 'warning' | 'critical';

export interface SecurityTelemetryEvent {
  id: ID;
  category: SecurityTelemetryCategory;
  eventName: string;
  outcome: SecurityTelemetryOutcome;
  severity: SecurityTelemetrySeverity;
  workspaceId: ID | null;
  actorUserId: ID | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  details: Record<string, unknown>;
}

export interface SecurityTelemetryAlert {
  id: ID;
  severity: SecurityTelemetrySeverity;
  title: string;
  description: string;
  count: number;
  threshold: number;
}

export interface WorkspaceSecurityDashboard {
  workspaceId: ID;
  generatedAt: string;
  windowMinutes: number;
  counters: {
    authFailures: number;
    invitationFailures: number;
    destructiveActions: number;
    destructiveFailures: number;
    authorizationFailures: number;
  };
  alerts: SecurityTelemetryAlert[];
  recentEvents: SecurityTelemetryEvent[];
}

export interface WorkspaceSecurityDashboardResponse {
  dashboard: WorkspaceSecurityDashboard;
}

export interface WorkspaceOwnershipTransferResponse {
  previousOwnerMembership: WorkspaceMemberDetail;
  nextOwnerMembership: WorkspaceMemberDetail;
}

export interface WorkspaceBulkInvitationRevocationResponse {
  revokedCount: number;
}

export interface PublicWorkspaceShareLinkSummary {
  id: ID;
  workspaceId: ID;
  role: WorkspaceRole;
  expiresAt: string;
  revokedAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PublicWorkspaceShareLinkLookup {
  shareLink: PublicWorkspaceShareLinkSummary;
  workspace: WorkspaceSummary;
  status: WorkspaceShareLinkStatus;
}

export interface WorkspaceSummary {
  id: ID;
  name: string;
  slug: string;
  createdByUserId: ID;
  createdAt: string;
  updatedAt: string;
}

export interface AuthenticatedWorkspace extends WorkspaceSummary {
  membership: WorkspaceMembershipSummary;
}

export interface WorkspaceDetails extends AuthenticatedWorkspace {
  memberCount: number;
  invitationCount: number;
}

export interface TaskSummary {
  id: ID;
  workspaceId: ID;
  title: string;
  description: string | null;
  dueDate: string | null;
  status: TaskStatus;
  createdByUserId: ID;
  assigneeUserId: ID | null;
  createdAt: string;
  updatedAt: string;
  createdByUser: TaskActorSummary;
  assigneeUser: TaskActorSummary | null;
}

export type TaskDetails = TaskSummary;

export interface TaskActorSummary {
  id: ID;
  displayName: string;
}

export interface TaskResponse {
  task: TaskDetails;
}

export interface TaskListResponse {
  tasks: TaskSummary[];
  limit: number;
  hasMore: boolean;
  nextCursor: ID | null;
}

export interface TaskDeleteResponse {
  success: true;
}

export interface InviteWorkspaceMemberResult {
  kind: 'invitation';
  invitation: WorkspaceInvitationSummary;
  token: string;
  inviteUrl: string;
}

export interface AuthPayload {
  user: UserSummary;
  workspaces: AuthenticatedWorkspace[];
  accessToken: string;
}

export interface RegisterResponse extends AuthPayload {
  workspace: WorkspaceSummary;
  memberships: WorkspaceMembershipSummary[];
}

export interface JwtAccessTokenPayload {
  sub: ID;
  sessionId: ID;
  email: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
  type: 'access';
}

export interface WorkspaceBoardDataResponse {
  workspace: WorkspaceDetails;
  members: WorkspaceMemberDetail[];
  membersLoaded: boolean;
  tasks: TaskSummary[];
  limit: number;
  hasMore: boolean;
  nextCursor: ID | null;
}
