'use client';

import { useEffect, useState, type SyntheticEvent } from 'react';
import { WORKSPACE_NAME_MAX_LENGTH } from '@teamwork/validation';
import { ApiError, createWorkspace } from '@/lib/api/client';
import { useAuthSession } from '@/lib/auth/auth-session-provider';
import { validateCreateWorkspaceInput } from '@/lib/workspace-create';
import { AppButton } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, FormMessage, getTextControlClassName } from '@/components/ui/form-controls';

interface CreateWorkspaceModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (workspaceId: string) => void;
}

const INITIAL_VALUES = {
  name: '',
};

export function CreateWorkspaceModal({
  open,
  onClose,
  onCreated,
}: CreateWorkspaceModalProps) {
  const { accessToken, refreshSession } = useAuthSession();
  const [values, setValues] = useState(INITIAL_VALUES);
  const [errors, setErrors] = useState<Partial<Record<'name' | 'form', string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setValues(INITIAL_VALUES);
      setErrors({});
      setIsSubmitting(false);
    }
  }, [open]);

  const handleFieldChange = (value: string) => {
    setValues({
      name: value,
    });
    setErrors((current) => {
      if (!current.name && !current.form) {
        return current;
      }

      return {};
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

    const validation = validateCreateWorkspaceInput(values);

    if (!validation.input) {
      setErrors(validation.errors);
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      const response = await createWorkspace(accessToken, validation.input);
      await refreshSession();
      onCreated(response.workspace.id);
      onClose();
    } catch (error) {
      setErrors({
        form:
          error instanceof ApiError || error instanceof Error
            ? error.message
            : 'Workspace creation failed.',
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
      title="Create Workspace"
      description="Set up a new workspace and start planning with your team."
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
            form="create-workspace-form"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Creating...' : 'Create Workspace'}
          </AppButton>
        </>
      }
    >
      <form
        id="create-workspace-form"
        className="flex flex-col gap-4"
        onSubmit={handleFormSubmit}
      >
        <Field
          label="Workspace Name"
          required
          error={errors.name}
          hint="Choose a name your team will instantly recognize."
        >
          <input
            value={values.name}
            onChange={(event) => {
              handleFieldChange(event.target.value);
            }}
            maxLength={WORKSPACE_NAME_MAX_LENGTH}
            className={getTextControlClassName(Boolean(errors.name), 'strong')}
            placeholder="Product Roadmap"
          />
        </Field>
        {errors.form ? <FormMessage message={errors.form} /> : null}
      </form>
    </Dialog>
  );
}
