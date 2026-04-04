'use client';

import { useEffect, useMemo, useState, type SyntheticEvent } from 'react';
import type { TaskDetails, WorkspaceMemberDetail } from '@teamwork/types';
import { ApiError, createWorkspaceTask } from '@/lib/api/client';
import { useAuthSession } from '@/lib/auth/auth-session-provider';
import {
  validateCreateTaskInput,
  type CreateTaskFormValues,
} from '@/lib/task-create';
import { AppButton } from '@/components/ui/button';
import { Field, FormMessage, getTextControlClassName } from '@/components/ui/form-controls';
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
      description="Add a new task to this workspace board."
      onClose={handleClose}
      footer={
        <>
          <AppButton
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            variant="secondary"
          >
            Cancel
          </AppButton>
          <AppButton
            type="submit"
            form="create-task-form"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Creating...' : 'Create Task'}
          </AppButton>
        </>
      }
    >
      <form id="create-task-form" className="flex flex-col gap-5" onSubmit={handleFormSubmit}>
        <Field
          label="Title"
          required
          error={errors.title}
        >
          <input
            value={values.title}
            onChange={(event) => {
              handleFieldChange('title', event.target.value);
            }}
            maxLength={200}
            className={getTextControlClassName(Boolean(errors.title), 'strong')}
            placeholder="Task title"
          />
        </Field>

        <Field
          label="Description"
          error={errors.description}
        >
          <textarea
            value={values.description}
            onChange={(event) => {
              handleFieldChange('description', event.target.value);
            }}
            maxLength={5000}
            rows={5}
            className={`${getTextControlClassName(Boolean(errors.description), 'strong')} min-h-[132px] resize-none`}
            placeholder="Description"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3 rounded-[0.95rem] border border-line/80 bg-surface-muted/55 p-3.5">
          <Field
            label="Assign To"
            error={errors.assigneeUserId}
            hint={
              isAssigneeSelectionDisabled
                ? 'Members are still loading.'
                : 'Optional workspace member.'
            }
          >
            <select
              value={values.assigneeUserId}
              onChange={(event) => {
                handleFieldChange('assigneeUserId', event.target.value);
              }}
              disabled={isAssigneeSelectionDisabled}
              className={getTextControlClassName(Boolean(errors.assigneeUserId), 'strong')}
            >
              <option value="">Unassigned</option>
              {assigneeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Due Date"
            error={errors.dueDate}
            hint="Optional deadline."
          >
            <input
              type="date"
              value={values.dueDate}
              onChange={(event) => {
                handleFieldChange('dueDate', event.target.value);
              }}
              className={getTextControlClassName(Boolean(errors.dueDate), 'strong')}
            />
          </Field>
        </div>

        {errors.form ? <FormMessage message={errors.form} /> : null}
      </form>
    </Dialog>
  );
}
