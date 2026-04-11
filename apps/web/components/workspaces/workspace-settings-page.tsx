'use client';

import { useMemo, useState } from 'react';
import type { WorkspaceMemberDetail, WorkspaceSecurityDashboard, WorkspaceShareLinkSummary } from '@teamwork/types';
import {
  ApiError,
  disableWorkspaceShareLink,
  revokeAllWorkspaceInvitations,
  transferWorkspaceOwnership,
} from '@/lib/api/client';
import { ContentPanel, ContentPanelHeader, StatusBadge } from '@/components/app-shell/page-state';
import { AppButton } from '@/components/ui/button';
import { FormMessage } from '@/components/ui/form-controls';

interface WorkspaceSettingsPageProps {
  workspaceId: string;
  currentUserId: string;
  members: WorkspaceMemberDetail[];
  pendingInvitationCount: number;
  shareLink: WorkspaceShareLinkSummary | null;
  dashboard: WorkspaceSecurityDashboard;
  accessToken: string | null;
  onOwnershipTransferred: () => Promise<void>;
}

export function WorkspaceSettingsPage({
  workspaceId,
  currentUserId,
  members,
  pendingInvitationCount,
  shareLink,
  dashboard,
  accessToken,
  onOwnershipTransferred,
}: WorkspaceSettingsPageProps) {
  const [localMembers, setLocalMembers] = useState(members);
  const [localInvitationCount, setLocalInvitationCount] = useState(pendingInvitationCount);
  const [localShareLink, setLocalShareLink] = useState(shareLink);
  const [selectedNextOwnerUserId, setSelectedNextOwnerUserId] = useState<string>('');
  const [transferMessage, setTransferMessage] = useState<string | null>(null);
  const [governanceMessage, setGovernanceMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isTransferringOwnership, setIsTransferringOwnership] = useState(false);
  const [isRevokingInvitations, setIsRevokingInvitations] = useState(false);
  const [isDisablingShareLink, setIsDisablingShareLink] = useState(false);

  const ownershipCandidates = useMemo(
    () =>
      localMembers
        .filter((member) => member.userId !== currentUserId)
        .sort((left, right) => left.user.displayName.localeCompare(right.user.displayName)),
    [currentUserId, localMembers],
  );

  const handleTransferOwnership = async () => {
    if (!accessToken) {
      setErrorMessage('Your session is unavailable. Refresh and try again.');
      return;
    }

    if (!selectedNextOwnerUserId) {
      setErrorMessage('Choose a member to transfer ownership to.');
      return;
    }

    setIsTransferringOwnership(true);
    setErrorMessage(null);
    setTransferMessage(null);

    try {
      const result = await transferWorkspaceOwnership(
        workspaceId,
        accessToken,
        selectedNextOwnerUserId,
      );

      setLocalMembers((current) =>
        current.map((member) => {
          if (member.userId === result.nextOwnerMembership.userId) {
            return result.nextOwnerMembership;
          }

          if (member.userId === result.previousOwnerMembership.userId) {
            return result.previousOwnerMembership;
          }

          return member;
        }),
      );
      setTransferMessage(
        `Ownership transferred to ${result.nextOwnerMembership.user.displayName}.`,
      );
      setSelectedNextOwnerUserId('');
      await onOwnershipTransferred();
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError || error instanceof Error
          ? error.message
          : 'Ownership transfer failed.',
      );
    } finally {
      setIsTransferringOwnership(false);
    }
  };

  const handleRevokeAllInvitations = async () => {
    if (!accessToken) {
      setErrorMessage('Your session is unavailable. Refresh and try again.');
      return;
    }

    setIsRevokingInvitations(true);
    setErrorMessage(null);
    setGovernanceMessage(null);

    try {
      const result = await revokeAllWorkspaceInvitations(workspaceId, accessToken);
      setLocalInvitationCount((current) => Math.max(0, current - result.revokedCount));
      setGovernanceMessage(
        result.revokedCount === 0
          ? 'No pending invitations were active.'
          : `Revoked ${String(result.revokedCount)} pending invitation(s).`,
      );
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError || error instanceof Error
          ? error.message
          : 'Invitation revocation failed.',
      );
    } finally {
      setIsRevokingInvitations(false);
    }
  };

  const handleDisableShareLink = async () => {
    if (!accessToken || !localShareLink) {
      return;
    }

    setIsDisablingShareLink(true);
    setErrorMessage(null);
    setGovernanceMessage(null);

    try {
      const result = await disableWorkspaceShareLink(workspaceId, accessToken);
      setLocalShareLink(result.shareLink);
      setGovernanceMessage('Workspace share link has been disabled.');
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError || error instanceof Error
          ? error.message
          : 'Share link disable action failed.',
      );
    } finally {
      setIsDisablingShareLink(false);
    }
  };

  return (
    <>
      {transferMessage ? <FormMessage tone="info" message={transferMessage} /> : null}
      {governanceMessage ? <FormMessage tone="info" message={governanceMessage} /> : null}
      {errorMessage ? <FormMessage message={errorMessage} /> : null}

      <ContentPanel>
        <ContentPanelHeader
          title="Ownership"
          description="Transfer workspace ownership when stewardship changes."
        />
        <div className="grid gap-4 px-7 py-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="text-[0.9rem] leading-6 text-muted">
              Transferring ownership demotes your role to member and grants full owner permissions to
              the selected user.
            </p>
            <label htmlFor="next-owner" className="mt-4 block text-[0.82rem] font-semibold uppercase tracking-[0.14em] text-muted">
              Next owner
            </label>
            <select
              id="next-owner"
              value={selectedNextOwnerUserId}
              onChange={(event) => {
                setSelectedNextOwnerUserId(event.target.value);
              }}
              disabled={isTransferringOwnership}
              className="mt-2 w-full rounded-[0.85rem] border border-line bg-surface px-3.5 py-2.5 text-[0.94rem] text-foreground outline-none transition-colors focus:border-accent disabled:opacity-60"
            >
              <option value="">Select a member</option>
              {ownershipCandidates.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {member.user.displayName} ({member.user.email})
                </option>
              ))}
            </select>
          </div>
          <AppButton
            type="button"
            onClick={() => {
              void handleTransferOwnership();
            }}
            disabled={isTransferringOwnership || ownershipCandidates.length === 0}
            className="lg:min-w-[13.5rem]"
          >
            {isTransferringOwnership ? 'Transferring...' : 'Transfer Ownership'}
          </AppButton>
        </div>
      </ContentPanel>

      <ContentPanel>
        <ContentPanelHeader
          title="Governance Actions"
          description="Owner-level controls for invitation and access cleanup."
        />
        <div className="grid gap-4 px-7 py-6 md:grid-cols-2">
          <ActionCard
            title="Pending Invitations"
            metric={String(localInvitationCount)}
            description="Revoke every pending invitation in one action."
            actionLabel={isRevokingInvitations ? 'Revoking...' : 'Revoke All Invitations'}
            onAction={() => {
              void handleRevokeAllInvitations();
            }}
            disabled={isRevokingInvitations}
          />
          <ActionCard
            title="Workspace Share Link"
            metric={localShareLink ? formatShareLinkStatus(localShareLink.status) : 'Unavailable'}
            description="Disable the workspace join link to immediately block further joins."
            actionLabel={isDisablingShareLink ? 'Disabling...' : 'Disable Share Link'}
            onAction={() => {
              void handleDisableShareLink();
            }}
            disabled={
              isDisablingShareLink ||
              !localShareLink ||
              localShareLink.status !== 'active'
            }
          />
        </div>
      </ContentPanel>

      <ContentPanel>
        <ContentPanelHeader
          title="Security Telemetry"
          description={`Live dashboard for the last ${String(dashboard.windowMinutes)} minutes.`}
        />
        <div className="grid gap-3 px-7 py-5 sm:grid-cols-2 lg:grid-cols-5">
          <MetricCard label="Auth failures" value={dashboard.counters.authFailures} />
          <MetricCard label="Invitation failures" value={dashboard.counters.invitationFailures} />
          <MetricCard label="Destructive actions" value={dashboard.counters.destructiveActions} />
          <MetricCard label="Destructive failures" value={dashboard.counters.destructiveFailures} />
          <MetricCard label="Policy denials" value={dashboard.counters.authorizationFailures} />
        </div>

        <div className="border-t border-line px-7 py-5">
          <p className="text-[0.9rem] font-semibold text-foreground">Alerts</p>
          {dashboard.alerts.length === 0 ? (
            <p className="mt-2 text-[0.9rem] leading-6 text-muted">No active alert thresholds triggered.</p>
          ) : (
            <div className="mt-3 space-y-2.5">
              {dashboard.alerts.map((alert) => (
                <div key={alert.id} className="rounded-[0.85rem] border border-line bg-surface-muted/70 px-3.5 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge label={alert.severity.toUpperCase()} tone={alert.severity === 'critical' ? 'accent' : 'progress'} />
                    <p className="text-[0.92rem] font-semibold text-foreground">{alert.title}</p>
                  </div>
                  <p className="mt-1 text-[0.86rem] leading-6 text-muted">{alert.description}</p>
                  <p className="mt-1 text-[0.78rem] text-muted">
                    Count: {String(alert.count)} (threshold: {String(alert.threshold)})
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-line px-7 py-5">
          <p className="text-[0.9rem] font-semibold text-foreground">Recent security events</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-[0.84rem]">
              <thead>
                <tr className="border-b border-line text-muted">
                  <th className="py-2 pr-3 font-semibold">Time</th>
                  <th className="py-2 pr-3 font-semibold">Event</th>
                  <th className="py-2 pr-3 font-semibold">Outcome</th>
                  <th className="py-2 pr-3 font-semibold">Category</th>
                  <th className="py-2 pr-3 font-semibold">Actor</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.recentEvents.map((event) => (
                  <tr key={event.id} className="border-b border-line/60 text-foreground">
                    <td className="py-2.5 pr-3 align-top text-muted">{formatTimestamp(event.createdAt)}</td>
                    <td className="py-2.5 pr-3 align-top">{event.eventName}</td>
                    <td className="py-2.5 pr-3 align-top">
                      <span className={event.outcome === 'failure' ? 'text-danger' : 'text-foreground'}>
                        {event.outcome}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 align-top text-muted">{event.category}</td>
                    <td className="py-2.5 pr-3 align-top text-muted">{event.actorUserId ?? 'n/a'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </ContentPanel>
    </>
  );
}

function ActionCard({
  title,
  metric,
  description,
  actionLabel,
  onAction,
  disabled,
}: {
  title: string;
  metric: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  disabled: boolean;
}) {
  return (
    <div className="rounded-[0.95rem] border border-line bg-surface px-4 py-4">
      <p className="text-[0.82rem] font-semibold uppercase tracking-[0.14em] text-muted">{title}</p>
      <p className="mt-2 text-[1.24rem] font-semibold tracking-tight text-foreground">{metric}</p>
      <p className="mt-2 text-[0.86rem] leading-6 text-muted">{description}</p>
      <AppButton
        type="button"
        variant="secondary"
        size="compact"
        onClick={onAction}
        disabled={disabled}
        className="mt-3"
      >
        {actionLabel}
      </AppButton>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[0.85rem] border border-line bg-surface px-3.5 py-3">
      <p className="text-[0.78rem] uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className="mt-1 text-[1.2rem] font-semibold tracking-tight text-foreground">{String(value)}</p>
    </div>
  );
}

function formatShareLinkStatus(status: WorkspaceShareLinkSummary['status']): string {
  if (status === 'active') {
    return 'Active';
  }

  if (status === 'revoked') {
    return 'Disabled';
  }

  return 'Expired';
}

function formatTimestamp(value: string): string {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
}

export function WorkspaceSettingsPageSkeleton() {
  return (
    <ContentPanel>
      <div className="space-y-3 px-7 py-6">
        <div className="h-8 w-44 animate-pulse rounded-xl bg-black/10" />
        <div className="h-4 w-88 max-w-full animate-pulse rounded-full bg-black/5" />
        <div className="h-10 w-full animate-pulse rounded-[0.85rem] bg-black/5" />
      </div>
    </ContentPanel>
  );
}
