'use client';

import { useEffect, useState, type ReactNode, type SyntheticEvent } from 'react';
import type { InviteWorkspaceMemberResult, WorkspaceRole } from '@teamwork/types';
import { ApiError, inviteWorkspaceMember } from '@/lib/api/client';
import { isValidEmailAddress } from '@/lib/auth/forms';
import { Dialog } from '@/components/ui/dialog';

interface InviteMemberModalProps {
  open: boolean;
  workspaceId: string;
  accessToken: string | null;
  onClose: () => void;
  onCreated: (result: InviteWorkspaceMemberResult) => void;
}

type InviteFormErrors = Partial<Record<'email' | 'form', string>>;

const INITIAL_VALUES = {
  email: '',
  role: 'member' as WorkspaceRole,
};

export function InviteMemberModal({
  open,
  workspaceId,
  accessToken,
  onClose,
  onCreated,
}: InviteMemberModalProps) {
  const [values, setValues] = useState(INITIAL_VALUES);
  const [errors, setErrors] = useState<InviteFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setValues(INITIAL_VALUES);
      setErrors({});
      setIsSubmitting(false);
    }
  }, [open]);

  const handleClose = () => {
    if (isSubmitting) {
      return;
    }

    onClose();
  };

  const handleSubmit = async () => {
    const email = values.email.trim();

    if (!email) {
      setErrors({ email: 'Email is required.' });
      return;
    }

    if (!isValidEmailAddress(email)) {
      setErrors({ email: 'Enter a valid email address.' });
      return;
    }

    if (!accessToken) {
      setErrors({ form: 'Your session is unavailable. Refresh the page and try again.' });
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      const result = await inviteWorkspaceMember(workspaceId, accessToken, {
        email,
        role: values.role,
      });
      onCreated(result);
      onClose();
    } catch (error) {
      setErrors({
        form:
          error instanceof ApiError || error instanceof Error
            ? error.message
            : 'Invitation could not be created.',
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
      title="Invite Member"
      description="Invite a new member to your workspace and share their invitation link."
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
            form="invite-member-form"
            disabled={isSubmitting}
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-accent px-5 text-sm font-semibold text-white transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Inviting...' : 'Invite Member'}
          </button>
        </>
      }
    >
      <form
        id="invite-member-form"
        className="flex flex-col gap-6"
        onSubmit={handleFormSubmit}
      >
        <FieldBlock label="Email" error={errors.email} hint="Send an invitation to this email address.">
          <input
            type="email"
          value={values.email}
          autoComplete="email"
          onChange={(event) => {
              const nextEmail = event.target.value;
              setValues((current) => ({
                ...current,
                email: nextEmail,
              }));
              setErrors((current) => {
                if (!current.email && !current.form) {
                  return current;
                }

                const { email: removedEmail, form: removedForm, ...remaining } = current;
                void removedEmail;
                void removedForm;
                return remaining;
              });
            }}
            className={getFieldClassName(Boolean(errors.email))}
            placeholder="member@example.com"
          />
        </FieldBlock>

        <FieldBlock
          label="Role"
          error={undefined}
          hint="Owners can manage members and invitations. Members keep standard workspace access."
        >
          <select
            value={values.role}
            onChange={(event) => {
              const nextRole = readWorkspaceRole(event.target.value);

              if (nextRole) {
                setValues((current) => ({
                  ...current,
                  role: nextRole,
                }));
              }
            }}
            className={getFieldClassName(false)}
          >
            <option value="member">Member</option>
            <option value="owner">Owner</option>
          </select>
        </FieldBlock>

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
  hint,
  error,
  children,
}: {
  label: string;
  hint: string | undefined;
  error: string | undefined;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2.5">
      <span className="text-sm font-semibold text-foreground">{label}</span>
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

function readWorkspaceRole(value: string): WorkspaceRole | null {
  if (value === 'owner' || value === 'member') {
    return value;
  }

  return null;
}
