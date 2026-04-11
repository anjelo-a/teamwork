import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type SecurityTelemetryCategory = 'auth' | 'invitation' | 'destructive' | 'authorization';
type SecurityTelemetryOutcome = 'success' | 'failure';
type SecurityTelemetrySeverity = 'info' | 'warning' | 'critical';

interface SecurityTelemetryEvent {
  id: string;
  category: SecurityTelemetryCategory;
  eventName: string;
  outcome: SecurityTelemetryOutcome;
  severity: SecurityTelemetrySeverity;
  workspaceId: string | null;
  actorUserId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  details: Record<string, unknown>;
}

interface SecurityTelemetryAlert {
  id: string;
  severity: SecurityTelemetrySeverity;
  title: string;
  description: string;
  count: number;
  threshold: number;
}

interface WorkspaceSecurityDashboard {
  workspaceId: string;
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

@Injectable()
export class SecurityTelemetryService {
  private readonly logger = new Logger(SecurityTelemetryService.name);
  private readonly events: SecurityTelemetryEvent[] = [];
  private readonly maxEvents: number;

  constructor(private readonly configService: ConfigService) {
    this.maxEvents = this.configService.get<number>('SECURITY_TELEMETRY_MAX_EVENTS') ?? 4000;
  }

  record(input: {
    category: SecurityTelemetryCategory;
    eventName: string;
    outcome: SecurityTelemetryOutcome;
    severity?: SecurityTelemetrySeverity;
    workspaceId?: string | null;
    actorUserId?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
    details?: Record<string, unknown>;
  }): void {
    const event: SecurityTelemetryEvent = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
      category: input.category,
      eventName: input.eventName,
      outcome: input.outcome,
      severity: input.severity ?? (input.outcome === 'failure' ? 'warning' : 'info'),
      workspaceId: input.workspaceId ?? null,
      actorUserId: input.actorUserId ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      createdAt: new Date().toISOString(),
      details: input.details ?? {},
    };

    this.events.push(event);

    if (this.events.length > this.maxEvents) {
      this.events.splice(0, this.events.length - this.maxEvents);
    }

    this.logger.log(
      JSON.stringify({
        logCategory: 'security',
        ...event,
      }),
    );
  }

  getWorkspaceDashboard(input: {
    workspaceId: string;
    windowMinutes?: number;
    recentLimit?: number;
  }): WorkspaceSecurityDashboard {
    const windowMinutes = input.windowMinutes ?? 60;
    const recentLimit = input.recentLimit ?? 25;
    const minTimestamp = Date.now() - windowMinutes * 60_000;
    const scopedEvents = this.events.filter((event) => {
      const eventTime = Date.parse(event.createdAt);

      if (Number.isNaN(eventTime) || eventTime < minTimestamp) {
        return false;
      }

      if (event.workspaceId === input.workspaceId) {
        return true;
      }

      return event.category === 'auth';
    });

    const counters = {
      authFailures: scopedEvents.filter(
        (event) => event.category === 'auth' && event.outcome === 'failure',
      ).length,
      invitationFailures: scopedEvents.filter(
        (event) => event.category === 'invitation' && event.outcome === 'failure',
      ).length,
      destructiveActions: scopedEvents.filter(
        (event) => event.category === 'destructive' && event.outcome === 'success',
      ).length,
      destructiveFailures: scopedEvents.filter(
        (event) => event.category === 'destructive' && event.outcome === 'failure',
      ).length,
      authorizationFailures: scopedEvents.filter(
        (event) => event.category === 'authorization' && event.outcome === 'failure',
      ).length,
    };

    const alerts: SecurityTelemetryAlert[] = [];

    this.pushAlertIfThresholdReached(
      alerts,
      'auth-failures',
      'critical',
      'Auth failures elevated',
      'Authentication failure volume is above normal baseline.',
      counters.authFailures,
      this.configService.get<number>('SECURITY_ALERT_AUTH_FAILURE_THRESHOLD') ?? 12,
    );

    this.pushAlertIfThresholdReached(
      alerts,
      'invitation-abuse',
      'warning',
      'Invitation misuse signals detected',
      'Invitation/share-link lookups or accepts are failing unusually often.',
      counters.invitationFailures,
      this.configService.get<number>('SECURITY_ALERT_INVITATION_FAILURE_THRESHOLD') ?? 8,
    );

    this.pushAlertIfThresholdReached(
      alerts,
      'destructive-failures',
      'warning',
      'Failed destructive actions increasing',
      'Workspace destructive actions are repeatedly failing and should be reviewed.',
      counters.destructiveFailures,
      this.configService.get<number>('SECURITY_ALERT_DESTRUCTIVE_FAILURE_THRESHOLD') ?? 4,
    );

    const recentEvents = [...scopedEvents]
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
      .slice(0, recentLimit);

    return {
      workspaceId: input.workspaceId,
      generatedAt: new Date().toISOString(),
      windowMinutes,
      counters,
      alerts,
      recentEvents,
    };
  }

  private pushAlertIfThresholdReached(
    alerts: SecurityTelemetryAlert[],
    id: string,
    severity: SecurityTelemetrySeverity,
    title: string,
    description: string,
    count: number,
    threshold: number,
  ): void {
    if (count < threshold) {
      return;
    }

    alerts.push({
      id,
      severity,
      title,
      description,
      count,
      threshold,
    });
  }
}
