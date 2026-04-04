'use client';

import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  type SyntheticEvent,
} from 'react';
import type { TaskDetails, TaskStatus, WorkspaceMemberDetail } from '@teamwork/types';
import {
  ApiError,
  deleteWorkspaceTask,
  getWorkspaceTaskDetails,
  updateWorkspaceTask,
  updateWorkspaceTaskAssignee,
  updateWorkspaceTaskStatus,
} from '@/lib/api/client';
import { useAuthSession } from '@/lib/auth/auth-session-provider';
import {
  createTaskEditorValues,
  formatTaskTimestamp,
  isValidAssignee,
  validateTaskEditorValues,
  type TaskDetailErrorState,
  type TaskEditorValues,
} from '@/lib/task-details';
import { Dialog } from '@/components/ui/dialog';

interface TaskDetailsModalProps {
  workspaceId: string;
  taskId: string | null;
  open: boolean;
  members: WorkspaceMemberDetail[] | null;
  membersUnavailable: boolean;
  onClose: () => void;
  onTaskChanged: () => void;
  onTaskDeleted: () => void;
}

type DetailLoadState =
  | { status: 'idle' | 'loading'; task: null; errorMessage: null }
  | { status: 'success'; task: TaskDetails; errorMessage: null }
  | { status: 'error'; task: null; errorMessage: string };

const STATUS_OPTIONS: Array<{ value: TaskStatus; label: string }> = [
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'done', label: 'Done' },
];

const EMPTY_EDITOR_VALUES: TaskEditorValues = {
  title: '',
  description: '',
  dueDate: '',
};

export function TaskDetailsModal({
  workspaceId,
  taskId,
  open,
  members,
  membersUnavailable,
  onClose,
  onTaskChanged,
  onTaskDeleted,
}: TaskDetailsModalProps) {
  const { accessToken } = useAuthSession();
  const [detailState, setDetailState] = useState<DetailLoadState>({
    status: 'idle',
    task: null,
    errorMessage: null,
  });
  const [isEditing, setIsEditing] = useState(false);
  const [editorValues, setEditorValues] = useState(EMPTY_EDITOR_VALUES);
  const [editorErrors, setEditorErrors] = useState<TaskDetailErrorState>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isUpdatingAssignee, setIsUpdatingAssignee] = useState(false);
  const [isDeleteConfirming, setIsDeleteConfirming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(null);

  const assigneeOptions = useMemo(
    () =>
      members?.map((member) => ({
        value: member.userId,
        label: member.user.displayName,
      })) ?? [],
    [members],
  );

  useEffect(() => {
    if (!open || !taskId) {
      setDetailState({
        status: 'idle',
        task: null,
        errorMessage: null,
      });
      setIsEditing(false);
      setEditorValues(EMPTY_EDITOR_VALUES);
      setEditorErrors({});
      setActionErrorMessage(null);
      setIsDeleteConfirming(false);
      return;
    }

    if (!accessToken) {
      setDetailState({
        status: 'error',
        task: null,
        errorMessage: 'Your session is unavailable. Refresh the page and try again.',
      });
      return;
    }

    let isActive = true;
    setDetailState({
      status: 'loading',
      task: null,
      errorMessage: null,
    });

    void getWorkspaceTaskDetails(workspaceId, taskId, accessToken)
      .then((response) => {
        if (!isActive) {
          return;
        }

        setDetailState({
          status: 'success',
          task: response.task,
          errorMessage: null,
        });
        setEditorValues(createTaskEditorValues(response.task));
      })
      .catch((error: unknown) => {
        if (!isActive) {
          return;
        }

        setDetailState({
          status: 'error',
          task: null,
          errorMessage:
            error instanceof ApiError || error instanceof Error
              ? error.message
              : 'Task details could not be loaded.',
        });
      });

    return () => {
      isActive = false;
    };
  }, [accessToken, open, taskId, workspaceId]);

  const task = detailState.status === 'success' ? detailState.task : null;
  const isBusy =
    isSaving || isUpdatingStatus || isUpdatingAssignee || isDeleting || detailState.status === 'loading';
  const isAssigneeDisabled = membersUnavailable || members === null || isUpdatingAssignee || !task;

  const handleClose = () => {
    if (isDeleting) {
      return;
    }

    onClose();
  };

  const applyTaskUpdate = (nextTask: TaskDetails) => {
    setDetailState({
      status: 'success',
      task: nextTask,
      errorMessage: null,
    });
    setEditorValues(createTaskEditorValues(nextTask));
    setEditorErrors({});
    setActionErrorMessage(null);
    onTaskChanged();
  };

  const handleStatusChange = async (nextStatus: TaskStatus) => {
    if (!accessToken || !task || isUpdatingStatus || nextStatus === task.status) {
      return;
    }

    setActionErrorMessage(null);
    setIsUpdatingStatus(true);

    try {
      const response = await updateWorkspaceTaskStatus(workspaceId, task.id, accessToken, {
        status: nextStatus,
      });
      applyTaskUpdate(response.task);
    } catch (error) {
      setActionErrorMessage(readActionError(error, 'Task status could not be updated.'));
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleAssigneeChange = async (assigneeUserId: string) => {
    if (!accessToken || !task || isUpdatingAssignee) {
      return;
    }

    const nextAssigneeUserId = assigneeUserId || null;

    if (nextAssigneeUserId === task.assigneeUserId) {
      return;
    }

    if (!isValidAssignee(nextAssigneeUserId, members)) {
      setActionErrorMessage('Assignee must be a current workspace member.');
      return;
    }

    setActionErrorMessage(null);
    setIsUpdatingAssignee(true);

    try {
      const response = await updateWorkspaceTaskAssignee(workspaceId, task.id, accessToken, {
        assigneeUserId: nextAssigneeUserId,
      });
      applyTaskUpdate(response.task);
    } catch (error) {
      setActionErrorMessage(readActionError(error, 'Task assignee could not be updated.'));
    } finally {
      setIsUpdatingAssignee(false);
    }
  };

  const handleEditSubmit = async () => {
    if (!accessToken || !task) {
      setEditorErrors({
        form: 'Your session is unavailable. Refresh the page and try again.',
      });
      return;
    }

    const validation = validateTaskEditorValues(editorValues);

    if (!validation.input) {
      setEditorErrors(validation.errors);
      return;
    }

    setIsSaving(true);
    setEditorErrors({});
    setActionErrorMessage(null);

    try {
      const response = await updateWorkspaceTask(workspaceId, task.id, accessToken, validation.input);
      applyTaskUpdate(response.task);
      setIsEditing(false);
      setIsDeleteConfirming(false);
    } catch (error) {
      setEditorErrors({
        form: readActionError(error, 'Task changes could not be saved.'),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditFormSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    void handleEditSubmit();
  };

  const handleDelete = async () => {
    if (!accessToken || !task || isDeleting) {
      return;
    }

    setIsDeleting(true);
    setActionErrorMessage(null);

    try {
      await deleteWorkspaceTask(workspaceId, task.id, accessToken);
      onTaskDeleted();
      onClose();
    } catch (error) {
      setActionErrorMessage(readActionError(error, 'Task could not be deleted.'));
    } finally {
      setIsDeleting(false);
      setIsDeleteConfirming(false);
    }
  };

  const headerActions = (
    <>
      <IconActionButton
        label="Edit task"
        onClick={() => {
          if (!task || isBusy) {
            return;
          }

          setEditorValues(createTaskEditorValues(task));
          setEditorErrors({});
          setActionErrorMessage(null);
          setIsDeleteConfirming(false);
          setIsEditing(true);
        }}
        disabled={!task || isBusy}
      >
        <EditIcon />
      </IconActionButton>
      <IconActionButton
        label="Delete task"
        onClick={() => {
          if (!task || isBusy) {
            return;
          }

          setActionErrorMessage(null);
          setIsDeleteConfirming((current) => !current);
          setIsEditing(false);
        }}
        disabled={!task || isBusy}
      >
        <TrashIcon />
      </IconActionButton>
      <IconActionButton label="Close task details" onClick={handleClose} disabled={isDeleting}>
        <CloseIcon />
      </IconActionButton>
    </>
  );

  return (
    <Dialog
      open={open}
      title="Task Details"
      onClose={handleClose}
      headerActions={headerActions}
      hideDefaultCloseButton
      panelClassName="max-w-[760px]"
      bodyClassName="px-0 py-0"
      footer={
        isEditing ? (
          <>
            <button
              type="button"
              onClick={() => {
                if (!task || isSaving) {
                  return;
                }

                setEditorValues(createTaskEditorValues(task));
                setEditorErrors({});
                setActionErrorMessage(null);
                setIsEditing(false);
              }}
              disabled={isSaving}
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-line bg-surface-muted px-5 text-sm font-semibold text-foreground transition-colors hover:border-line-strong disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="task-details-edit-form"
              disabled={isSaving}
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-accent px-5 text-sm font-semibold text-white transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </>
        ) : null
      }
    >
      {detailState.status === 'loading' ? (
        <TaskDetailsLoadingState />
      ) : null}

      {detailState.status === 'error' ? (
        <TaskDetailsErrorState description={detailState.errorMessage} />
      ) : null}

      {task ? (
        <form id="task-details-edit-form" onSubmit={handleEditFormSubmit}>
          <div className="border-b border-line px-7 py-6">
            {isEditing ? (
              <div className="space-y-4">
                <FieldBlock label="Title" error={editorErrors.title} hint={undefined}>
                  <input
                    value={editorValues.title}
                    onChange={(event) => {
                      setEditorValues((current) => ({
                        ...current,
                        title: event.target.value,
                      }));
                      clearEditorError('title', setEditorErrors);
                    }}
                    maxLength={200}
                    className={getFieldClassName(Boolean(editorErrors.title))}
                  />
                </FieldBlock>

                <FieldBlock label="Description" error={editorErrors.description} hint={undefined}>
                  <textarea
                    value={editorValues.description}
                    onChange={(event) => {
                      setEditorValues((current) => ({
                        ...current,
                        description: event.target.value,
                      }));
                      clearEditorError('description', setEditorErrors);
                    }}
                    rows={5}
                    maxLength={5000}
                    className={`${getFieldClassName(Boolean(editorErrors.description))} resize-none`}
                  />
                </FieldBlock>

                <FieldBlock label="Due Date" error={editorErrors.dueDate} hint={undefined}>
                  <input
                    type="date"
                    value={editorValues.dueDate}
                    onChange={(event) => {
                      setEditorValues((current) => ({
                        ...current,
                        dueDate: event.target.value,
                      }));
                      clearEditorError('dueDate', setEditorErrors);
                    }}
                    className={getFieldClassName(Boolean(editorErrors.dueDate))}
                  />
                </FieldBlock>
              </div>
            ) : (
              <div className="space-y-3">
                <h3 className="text-[2rem] font-semibold tracking-tight text-foreground">
                  {task.title}
                </h3>
                {task.description ? (
                  <p className="max-w-3xl text-[1rem] leading-7 text-muted">{task.description}</p>
                ) : (
                  <p className="text-sm leading-6 text-muted">No description added yet.</p>
                )}
                <p className="text-sm font-medium text-muted">
                  Due date: {task.dueDate ?? 'No due date'}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-6 px-7 py-6">
            <div className="grid grid-cols-2 gap-4">
              <FieldBlock
                label="Status"
                error={undefined}
                hint={isUpdatingStatus ? 'Saving status...' : undefined}
              >
                <select
                  value={task.status}
                  onChange={(event) => {
                    const nextStatus = readTaskStatusOption(event.target.value);

                    if (nextStatus) {
                      void handleStatusChange(nextStatus);
                    }
                  }}
                  disabled={isUpdatingStatus || isDeleting}
                  className={getFieldClassName(false)}
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </FieldBlock>

              <FieldBlock
                label="Assignee"
                error={undefined}
                hint={
                  isUpdatingAssignee
                    ? 'Saving assignee...'
                    : isAssigneeDisabled
                      ? 'Assignee changes are unavailable until workspace members load.'
                      : undefined
                }
              >
                <select
                  value={task.assigneeUserId ?? ''}
                  onChange={(event) => {
                    void handleAssigneeChange(event.target.value);
                  }}
                  disabled={isAssigneeDisabled || isDeleting}
                  className={getFieldClassName(false)}
                >
                  <option value="">Unassigned</option>
                  {assigneeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </FieldBlock>
            </div>

            <div className="border-t border-line pt-5 text-[1rem] leading-8 text-muted">
              <p>Created by {task.createdByUser.displayName}</p>
              <p>Created {formatTaskTimestamp(task.createdAt)}</p>
              <p>Last updated {formatTaskTimestamp(task.updatedAt)}</p>
            </div>

            {isDeleteConfirming ? (
              <div className="rounded-[1.2rem] border border-danger/20 bg-danger-soft px-5 py-4">
                <p className="text-sm font-semibold text-danger">Delete this task?</p>
                <p className="mt-1 text-sm leading-6 text-danger">
                  This permanently removes the task from the board.
                </p>
                <div className="mt-4 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setIsDeleteConfirming(false);
                    }}
                    disabled={isDeleting}
                    className="inline-flex min-h-10 items-center justify-center rounded-full border border-line bg-white px-4 text-sm font-semibold text-foreground transition-colors hover:border-line-strong disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Keep Task
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void handleDelete();
                    }}
                    disabled={isDeleting}
                    className="inline-flex min-h-10 items-center justify-center rounded-full bg-danger px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isDeleting ? 'Deleting...' : 'Delete Task'}
                  </button>
                </div>
              </div>
            ) : null}

            {editorErrors.form || actionErrorMessage ? (
              <div className="rounded-[1.1rem] border border-danger/20 bg-danger-soft px-4 py-3 text-sm leading-6 text-danger">
                {editorErrors.form ?? actionErrorMessage}
              </div>
            ) : null}
          </div>
        </form>
      ) : null}
    </Dialog>
  );
}

function TaskDetailsLoadingState() {
  return (
    <div className="space-y-6 px-7 py-6">
      <div className="space-y-3 border-b border-line pb-6">
        <div className="h-10 w-72 rounded-2xl bg-surface-muted" />
        <div className="h-6 w-full rounded-2xl bg-surface-muted" />
        <div className="h-6 w-52 rounded-2xl bg-surface-muted" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="h-24 rounded-[1rem] bg-surface-muted" />
        <div className="h-24 rounded-[1rem] bg-surface-muted" />
      </div>
      <div className="h-28 rounded-[1rem] bg-surface-muted" />
    </div>
  );
}

function TaskDetailsErrorState({ description }: { description: string }) {
  return (
    <div className="px-7 py-8">
      <div className="rounded-[1.2rem] border border-danger/20 bg-danger-soft px-5 py-4">
        <p className="text-base font-semibold text-danger">Task unavailable</p>
        <p className="mt-1 text-sm leading-6 text-danger">{description}</p>
      </div>
    </div>
  );
}

function FieldBlock({
  label,
  children,
  hint,
  error,
}: {
  label: string;
  children: ReactNode;
  hint: string | undefined;
  error: string | undefined;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-[0.95rem] font-semibold text-[#7d8da8]">{label}</span>
      {children}
      {error ? (
        <span className="text-sm text-danger">{error}</span>
      ) : hint ? (
        <span className="text-sm text-muted">{hint}</span>
      ) : null}
    </label>
  );
}

function IconActionButton({
  label,
  onClick,
  disabled = false,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[#7d8da8] transition-colors hover:bg-surface-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="M4 20h4l9.5-9.5a1.5 1.5 0 0 0 0-2.1l-1.9-1.9a1.5 1.5 0 0 0-2.1 0L4 16z" />
      <path d="m12.5 7.5 4 4" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="M4.5 7.5h15" />
      <path d="M9.5 7.5V5.8c0-.7.6-1.3 1.3-1.3h2.4c.7 0 1.3.6 1.3 1.3v1.7" />
      <path d="M7.5 7.5v10.2c0 .9.7 1.6 1.6 1.6h5.8c.9 0 1.6-.7 1.6-1.6V7.5" />
      <path d="M10 11v5" />
      <path d="M14 11v5" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="m7 7 10 10" />
      <path d="M17 7 7 17" />
    </svg>
  );
}

function getFieldClassName(hasError: boolean): string {
  return `min-h-12 rounded-[1rem] border bg-white px-4 py-3 text-sm text-foreground outline-none transition-colors ${
    hasError
      ? 'border-danger/40 focus:border-danger'
      : 'border-line focus:border-accent'
  }`;
}

function clearEditorError(
  field: keyof Pick<TaskDetailErrorState, 'title' | 'description' | 'dueDate'>,
  setEditorErrors: Dispatch<SetStateAction<TaskDetailErrorState>>,
) {
  setEditorErrors((current) => {
    if (!current[field] && !current.form) {
      return current;
    }

    const { [field]: removedField, form: removedForm, ...remaining } = current;
    void removedField;
    void removedForm;
    return remaining;
  });
}

function readActionError(error: unknown, fallback: string): string {
  if (error instanceof ApiError || error instanceof Error) {
    return error.message;
  }

  return fallback;
}

function readTaskStatusOption(value: string): TaskStatus | null {
  if (value === 'todo' || value === 'in_progress' || value === 'done') {
    return value;
  }

  return null;
}
