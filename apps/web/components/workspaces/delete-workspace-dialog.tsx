'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { deleteWorkspace, ApiError } from '@/lib/api/client';
import { useAuthSession } from '@/lib/auth/auth-session-provider';
import { resolveWorkspaceBoardRedirect } from '@/lib/auth/workspace-routing';
import { AppButton } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { FormMessage } from '@/components/ui/form-controls';

interface DeleteWorkspaceDialogProps {
  open: boolean;
  workspaceId: string;
  workspaceName: string;
  onClose: () => void;
}

export function DeleteWorkspaceDialog({
  open,
  workspaceId,
  workspaceName,
  onClose,
}: DeleteWorkspaceDialogProps) {
  const router = useRouter();
  const { accessToken, refreshSession } = useAuthSession();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleClose = () => {
    if (isDeleting) {
      return;
    }

    onClose();
  };

  const handleDelete = async () => {
    if (!accessToken) {
      setErrorMessage('Your session is unavailable. Refresh the page and try again.');
      return;
    }

    setIsDeleting(true);
    setErrorMessage(null);

    try {
      await deleteWorkspace(workspaceId, accessToken);
      const nextSession = await refreshSession();
      onClose();

      if (nextSession.status === 'unauthenticated') {
        router.replace('/auth-required');
        return;
      }

      const destinationPath =
        nextSession.status === 'authenticated'
          ? resolveWorkspaceBoardRedirect(nextSession.auth)
          : null;
      router.replace(destinationPath ?? '/');
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError || error instanceof Error
          ? error.message
          : 'Workspace deletion failed.',
      );
      setIsDeleting(false);
    }
  };

  return (
    <Dialog
      open={open}
      title="Delete workspace"
      description={`Delete ${workspaceName} and remove all workspace data?`}
      onClose={handleClose}
      footer={
        <>
          <AppButton
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={isDeleting}
          >
            Cancel
          </AppButton>
          <AppButton
            type="button"
            onClick={() => {
              void handleDelete();
            }}
            disabled={isDeleting}
            className="bg-danger text-white hover:bg-[#6f241f]"
          >
            {isDeleting ? 'Deleting...' : 'Delete Workspace'}
          </AppButton>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-[0.93rem] leading-6 text-muted">
          This permanently removes the workspace, its members, invitations, share links, and tasks.
        </p>
        {errorMessage ? <FormMessage message={errorMessage} /> : null}
      </div>
    </Dialog>
  );
}
