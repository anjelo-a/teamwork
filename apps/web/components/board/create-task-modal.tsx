'use client';

import { useEffect, useMemo, useState, type ReactNode, type SyntheticEvent } from 'react';
import type { TaskDetails, WorkspaceMemberDetail } from '@teamwork/types';
import { ApiError, createWorkspaceTask } from '@/lib/api/client';
import { useAuthSession } from '@/lib/auth/auth-session-provider';
import {
  validateCreateTaskInput,
  type CreateTaskFormValues,
} from '@/lib/task-create';
import { Dialog } from '@/components/ui/dialog';

interface CreateTaskModalProps {
  open: boolean;
  workspaceId: string;
  members: WorkspaceMemberDetail[] | null;
  membersUnavailable: boolean;
  onClose: () => void;
  onCreated: (task: TaskDetails) => void;
}

type CreateTaskErrorState = Partial<
  Record<'title' | 'description' | 'assigneeUserId' | 'dueDate' | 'form', string>
>;

const INITIAL_VALUES: CreateTaskFormValues = {
  title: '',
  description: '',
  assigneeUserId: '',
  dueDate: '',
};

export function CreateTaskModal({
  open,
  workspaceId,
  members,
  membersUnavailable,
  onClose,
  onCreated,
}: CreateTaskModalProps) {
  const { accessToken } = useAuthSession();
  const [values, setValues] = useState(INITIAL_VALUES);
  const [errors, setErrors] = useState<CreateTaskErrorState>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const assigneeOptions = useMemo(
    () =>
      members?.map((member) => ({
        value: member.userId,
        label: member.user.displayName,
      })) ?? [],
    [members],
  );
  const isAssigneeSelectionDisabled = membersUnavailable || members === null;

  useEffect(() => {
    if (!open) {
      setValues(INITIAL_VALUES);
      setErrors({});
      setIsSubmitting(false);
    }
  }, [open]);

  const handleFieldChange = (field: keyof CreateTaskFormValues, value: string) => {
    setValues((current) => ({
      ...current,
      [field]: value,
    }));
    setErrors((current) => {
      if (!current[field] && !current.form) {
        return current;
      }

      const { [field]: removedField, form: removedForm, ...remaining } = current;
      void removedField;
      void removedForm;

      return remaining;
    });
  };

  const handleClose = () => {
    if (isSubmitting) {
      return;
    }

    onClose();
  };

  const handleSubmit = async () => {
    if (!accessToken) {
      setErrors({
        form: 'Your session is unavailable. Refresh the page and try again.',
      });
      return;
    }

    const validation = validateCreateTaskInput(values, members);

    if (!validation.input) {
      setErrors(validation.errors);
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      const response = await createWorkspaceTask(workspaceId, accessToken, validation.input);
      onCreated(response.task);
      onClose();
    } catch (error) {
      setErrors({
        form:
          error instanceof ApiError || error instanceof Error
            ? error.message
            : 'Task creation failed.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFormSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    void handleSubmit();
  };

  return (
    <Dialog
      open={open}
      title="Create Task"
      description="Add a new task to this workspace board. Title and description come first, with assignment and due date available when needed."
      onClose={handleClose}
      footer={
        <>
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-line bg-surface-muted px-5 text-sm font-semibold text-foreground transition-colors hover:border-line-strong disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="create-task-form"
            disabled={isSubmitting}
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-accent px-5 text-sm font-semibold text-white transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Creating...' : 'Create Task'}
          </button>
        </>
      }
    >
      <form id="create-task-form" className="flex flex-col gap-6" onSubmit={handleFormSubmit}>
        <FieldBlock
          label="Title"
          required
          error={errors.title}
          hint="Keep the task title concise and clear."
        >
          <input
            value={values.title}
            onChange={(event) => {
              handleFieldChange('title', event.target.value);
            }}
            maxLength={200}
            className={getFieldClassName(Boolean(errors.title))}
            placeholder="Task title"
          />
        </FieldBlock>

        <FieldBlock
          label="Description"
          error={errors.description}
          hint="Optional context for the work to be done."
        >
          <textarea
            value={values.description}
            onChange={(event) => {
              handleFieldChange('description', event.target.value);
            }}
            maxLength={5000}
            rows={6}
            className={`${getFieldClassName(Boolean(errors.description))} resize-none`}
            placeholder="Add more detail if the task needs it"
          />
        </FieldBlock>

        <div className="grid grid-cols-2 gap-4 rounded-[1.35rem] border border-line bg-surface-muted/70 p-4">
          <FieldBlock
            label="Assign To"
            error={errors.assigneeUserId}
            hint={
              isAssigneeSelectionDisabled
                ? 'Members are not ready yet, so assignee selection is temporarily disabled.'
                : 'Optional workspace member assignment.'
            }
          >
            <select
              value={values.assigneeUserId}
              onChange={(event) => {
                handleFieldChange('assigneeUserId', event.target.value);
              }}
              disabled={isAssigneeSelectionDisabled}
              className={getFieldClassName(Boolean(errors.assigneeUserId))}
            >
              <option value="">Unassigned</option>
              {assigneeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FieldBlock>

          <FieldBlock
            label="Due Date"
            error={errors.dueDate}
            hint="Optional deadline stored as a date only."
          >
            <input
              type="date"
              value={values.dueDate}
              onChange={(event) => {
                handleFieldChange('dueDate', event.target.value);
              }}
              className={getFieldClassName(Boolean(errors.dueDate))}
            />
          </FieldBlock>
        </div>

        {errors.form ? (
          <div className="rounded-[1.1rem] border border-danger/20 bg-danger-soft px-4 py-3 text-sm leading-6 text-danger">
            {errors.form}
          </div>
        ) : null}
      </form>
    </Dialog>
  );
}

function FieldBlock({
  label,
  required = false,
  hint,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  hint: string | undefined;
  error: string | undefined;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2.5">
      <span className="text-sm font-semibold text-foreground">
        {label}
        {required ? <span className="ml-1 text-danger">*</span> : null}
      </span>
      {children}
      {error ? (
        <span className="text-sm text-danger">{error}</span>
      ) : hint ? (
        <span className="text-sm text-muted">{hint}</span>
      ) : null}
    </label>
  );
}

function getFieldClassName(hasError: boolean): string {
  return `min-h-12 rounded-[1rem] border bg-white px-4 py-3 text-sm text-foreground outline-none transition-colors ${
    hasError
      ? 'border-danger/40 focus:border-danger'
      : 'border-line focus:border-accent'
  }`;
}
