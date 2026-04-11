'use client';

import { useState } from 'react';
import { ApiError, updateWorkspace } from '@/lib/api/client';
import { useAuthSession } from '@/lib/auth/auth-session-provider';
import { AppButton } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { FormMessage, getTextControlClassName } from '@/components/ui/form-controls';

interface RenameWorkspaceDialogProps {
  open: boolean;
  workspaceId: string;
  workspaceName: string;
  onClose: () => void;
}

function normalizeWorkspaceName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

export function RenameWorkspaceDialog({
  open,
  workspaceId,
  workspaceName,
  onClose,
}: RenameWorkspaceDialogProps) {
  const { accessToken, refreshSession } = useAuthSession();
  const [name, setName] = useState(workspaceName);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleClose = () => {
    if (isSaving) {
      return;
    }

    onClose();
  };

  const handleRename = async () => {
    if (!accessToken) {
      setErrorMessage('Your session is unavailable. Refresh the page and try again.');
      return;
    }

    const normalizedName = normalizeWorkspaceName(name);

    if (normalizedName.length < 2) {
      setErrorMessage('Workspace name must be at least 2 characters.');
      return;
    }

    if (normalizedName === normalizeWorkspaceName(workspaceName)) {
      onClose();
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      await updateWorkspace(workspaceId, accessToken, {
        name: normalizedName,
      });
      await refreshSession();
      onClose();
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError || error instanceof Error
          ? error.message
          : 'Workspace could not be renamed.',
      );
      setIsSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      title="Rename workspace"
      description="Update the workspace name shown throughout TeamWork."
      onClose={handleClose}
      footer={
        <>
          <AppButton
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={isSaving}
          >
            Cancel
          </AppButton>
          <AppButton
            type="button"
            onClick={() => {
              void handleRename();
            }}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </AppButton>
        </>
      }
    >
      <div className="space-y-4">
        <label className="flex flex-col gap-2">
          <span className="text-[0.96rem] font-semibold text-foreground">Workspace name</span>
          <input
            type="text"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              if (errorMessage) {
                setErrorMessage(null);
              }
            }}
            maxLength={120}
            className={getTextControlClassName(Boolean(errorMessage))}
            placeholder="Workspace name"
          />
        </label>
        {errorMessage ? <FormMessage message={errorMessage} /> : null}
      </div>
    </Dialog>
  );
}
