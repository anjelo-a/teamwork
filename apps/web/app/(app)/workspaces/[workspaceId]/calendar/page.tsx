'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import { CreateTaskModal } from '@/components/board/create-task-modal';
import { TaskDetailsModal } from '@/components/board/task-details-modal';
import { CalendarLoadingState } from '@/components/calendar/calendar-loading';
import { CalendarPage } from '@/components/calendar/calendar-page';
import { PageStatusCard, PageSurface } from '@/components/app-shell/page-state';
import { useAuthSession } from '@/lib/auth/auth-session-provider';
import {
  getWorkspaceDetails,
  getWorkspaceMembers,
  listWorkspaceTasks,
} from '@/lib/api/client';
import {
  getTodayDateOnly,
  readCalendarAudienceFilter,
  readCalendarDate,
  readCalendarView,
  shiftCalendarDate,
} from '@/lib/calendar';
import { useAuthenticatedApiResource } from '@/lib/hooks/use-authenticated-api-resource';
import { useAppShellAction } from '@/lib/app-shell-action-context';
import { readWorkspaceIdFromParams } from '@/lib/route-params';
import {
  applyTaskOverlayMutation,
  applyTaskOverlayRemoval,
  mergeTaskListOverlay,
  type TaskListOverlay,
} from '@/lib/task-list';

export default function WorkspaceCalendarPage() {
  const params = useParams<{ workspaceId: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const workspaceId = readWorkspaceIdFromParams(params);
  const { auth } = useAuthSession();
  const { setActionOverride } = useAppShellAction();
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [taskItemsState, setTaskItemsState] = useState<{
    key: string | null;
    overlay: TaskListOverlay;
  }>({
    key: null,
    overlay: {
      tasks: [],
      removedTaskIds: [],
    },
  });

  const currentView = readCalendarView(searchParams.get('view'));
  const currentFilter = readCalendarAudienceFilter(searchParams.get('filter'));
  const selectedDate = readCalendarDate(searchParams.get('date'));
  const taskQueryKey = `workspace:${workspaceId}:tasks:calendar`;

  const workspaceQuery = useAuthenticatedApiResource({
    key: `workspace:${workspaceId}:calendar`,
    load: (accessToken) => getWorkspaceDetails(workspaceId, accessToken),
  });
  const membersQuery = useAuthenticatedApiResource({
    key: `workspace:${workspaceId}:members:calendar`,
    load: (accessToken) => getWorkspaceMembers(workspaceId, accessToken),
  });
  const tasksQuery = useAuthenticatedApiResource({
    key: taskQueryKey,
    load: (accessToken) => listWorkspaceTasks(workspaceId, accessToken),
  });
  const baseTaskItems = tasksQuery.status === 'success' ? tasksQuery.data.tasks : [];
  const taskItems =
    taskItemsState.key === taskQueryKey
      ? mergeTaskListOverlay(baseTaskItems, taskItemsState.overlay)
      : baseTaskItems;

  const applyCalendarParams = useCallback(
    (nextState: Partial<{ view: typeof currentView; filter: typeof currentFilter; date: string }>) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('view', nextState.view ?? currentView);
      params.set('filter', nextState.filter ?? currentFilter);
      params.set('date', nextState.date ?? selectedDate);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [currentFilter, currentView, pathname, router, searchParams, selectedDate],
  );

  const handleOpenCreateTaskModal = useCallback(() => {
    setIsCreateTaskOpen(true);
  }, []);

  const handleCloseCreateTaskModal = useCallback(() => {
    setIsCreateTaskOpen(false);
  }, []);

  const handleOpenTaskDetailsModal = useCallback((taskId: string) => {
    setSelectedTaskId(taskId);
  }, []);

  const handleCloseTaskDetailsModal = useCallback(() => {
    setSelectedTaskId(null);
  }, []);

  const handleFilterChange = useCallback(
    (filter: typeof currentFilter) => {
      applyCalendarParams({ filter });
    },
    [applyCalendarParams],
  );

  const handleViewChange = useCallback(
    (view: typeof currentView) => {
      applyCalendarParams({ view });
    },
    [applyCalendarParams],
  );

  const handleNavigate = useCallback(
    (direction: -1 | 1) => {
      applyCalendarParams({
        date: shiftCalendarDate(selectedDate, currentView, direction),
      });
    },
    [applyCalendarParams, currentView, selectedDate],
  );

  const handleGoToToday = useCallback(() => {
    applyCalendarParams({ date: getTodayDateOnly() });
  }, [applyCalendarParams]);

  const handleShowMore = useCallback(
    (date: string) => {
      applyCalendarParams({
        date,
        view: 'day',
      });
    },
    [applyCalendarParams],
  );
  const handlePrevious = useCallback(() => {
    handleNavigate(-1);
  }, [handleNavigate]);
  const handleNext = useCallback(() => {
    handleNavigate(1);
  }, [handleNavigate]);

  const membersUnavailable = membersQuery.status === 'error';

  const membersNote = useMemo(() => {
    if (!membersUnavailable) {
      return null;
    }

    return (
      <PageSurface
        eyebrow="Limited task controls"
        title="Members unavailable"
        description="Due-date tasks are available, but assignee-specific controls are unavailable until workspace members can be loaded."
      />
    );
  }, [membersUnavailable]);

  useEffect(() => {
    if (workspaceQuery.status !== 'success') {
      setActionOverride(null);
      return;
    }

    setActionOverride({
      label: 'Create Task',
      onAction: handleOpenCreateTaskModal,
    });

    return () => {
      setActionOverride(null);
    };
  }, [handleOpenCreateTaskModal, setActionOverride, workspaceQuery.status]);

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[72rem] flex-col gap-4">
      {workspaceQuery.status === 'loading' || tasksQuery.status === 'loading' ? (
        <CalendarLoadingState />
      ) : null}

      {workspaceQuery.status === 'error' ? (
        <PageStatusCard
          title="Calendar unavailable"
          description="This workspace calendar could not be loaded right now."
          tone="danger"
        />
      ) : null}

      {tasksQuery.status === 'error' ? (
        <PageStatusCard
          title="Tasks unavailable"
          description="Workspace tasks could not be loaded for this calendar."
          tone="danger"
        />
      ) : null}

      {workspaceQuery.status === 'success' && tasksQuery.status === 'success' ? (
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          {membersNote}

          {tasksQuery.data.hasMore ? (
            <PageSurface
              eyebrow="Task list capped"
              title={`Showing the newest ${tasksQuery.data.limit} tasks`}
              description="This calendar has more tasks than the current response includes. Refine the view or date range to narrow the list."
            />
          ) : null}

          <CalendarPage
            workspace={workspaceQuery.data.workspace}
            tasks={taskItems}
            currentUserId={auth.user.id}
            currentView={currentView}
            currentFilter={currentFilter}
            selectedDate={selectedDate}
            onFilterChange={handleFilterChange}
            onViewChange={handleViewChange}
            onPrevious={handlePrevious}
            onNext={handleNext}
            onToday={handleGoToToday}
            onTaskOpen={handleOpenTaskDetailsModal}
            onShowMore={handleShowMore}
          />
        </div>
      ) : null}

      <CreateTaskModal
        open={isCreateTaskOpen}
        workspaceId={workspaceId}
        members={membersQuery.status === 'success' ? membersQuery.data.members : null}
        membersUnavailable={membersUnavailable}
        onClose={handleCloseCreateTaskModal}
        onCreated={(task) => {
          setTaskItemsState((current) => ({
            key: taskQueryKey,
            overlay: applyTaskOverlayMutation(
              current.key === taskQueryKey
                ? current.overlay
                : { tasks: [], removedTaskIds: [] },
              task,
            ),
          }));
        }}
      />

      <TaskDetailsModal
        open={selectedTaskId !== null}
        taskId={selectedTaskId}
        workspaceId={workspaceId}
        members={membersQuery.status === 'success' ? membersQuery.data.members : null}
        membersUnavailable={membersUnavailable}
        onClose={handleCloseTaskDetailsModal}
        onTaskChanged={(task) => {
          setTaskItemsState((current) => ({
            key: taskQueryKey,
            overlay: applyTaskOverlayMutation(
              current.key === taskQueryKey
                ? current.overlay
                : { tasks: [], removedTaskIds: [] },
              task,
            ),
          }));
        }}
        onTaskDeleted={(taskId) => {
          setSelectedTaskId(null);
          setTaskItemsState((current) => ({
            key: taskQueryKey,
            overlay: applyTaskOverlayRemoval(
              current.key === taskQueryKey
                ? current.overlay
                : { tasks: [], removedTaskIds: [] },
              taskId,
            ),
          }));
        }}
      />
    </div>
  );
}
