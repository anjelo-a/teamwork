'use client';

import { useState, type SyntheticEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError, register } from '@/lib/api/client';
import { useAuthSession } from '@/lib/auth/auth-session-provider';
import {
  validateSignUpInput,
  type SignUpErrors,
  type SignUpFormValues,
} from '@/lib/auth/forms';
import { getWorkspaceBoardHref } from '@/lib/app-shell';
import { AuthFormError, AuthField, getAuthFieldClassName } from '@/components/auth/auth-form-controls';
import { AppButton } from '@/components/ui/button';

const INITIAL_VALUES: SignUpFormValues = {
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
};

export function SignUpForm() {
  const router = useRouter();
  const { setAccessToken } = useAuthSession();
  const [values, setValues] = useState(INITIAL_VALUES);
  const [errors, setErrors] = useState<SignUpErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFieldChange = (field: keyof SignUpFormValues, value: string) => {
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

  const handleSubmit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validation = validateSignUpInput(values);

    if (!validation.input) {
      setErrors(validation.errors);
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      const payload = await register(validation.input);
      const sessionResult = await setAccessToken(payload.accessToken);

      if (sessionResult.status !== 'authenticated') {
        setErrors({
          form:
            sessionResult.errorMessage ??
            'Account created, but the session could not be restored. Please try signing in.',
        });
        return;
      }

      const destinationWorkspace = sessionResult.auth.activeWorkspace ?? sessionResult.auth.workspaces[0];
      router.replace(destinationWorkspace ? getWorkspaceBoardHref(destinationWorkspace.id) : '/');
    } catch (error) {
      setErrors({
        form:
          error instanceof ApiError || error instanceof Error
            ? error.message
            : 'Sign up failed.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="flex flex-col gap-4.5" onSubmit={handleSubmit}>
      <AuthField label="Name" error={errors.name}>
        <input
          value={values.name}
          autoComplete="name"
          onChange={(event) => {
            handleFieldChange('name', event.target.value);
          }}
          className={getAuthFieldClassName(Boolean(errors.name))}
          placeholder="Your full name"
        />
      </AuthField>

      <AuthField label="Email" error={errors.email}>
        <input
          type="email"
          autoComplete="email"
          value={values.email}
          onChange={(event) => {
            handleFieldChange('email', event.target.value);
          }}
          className={getAuthFieldClassName(Boolean(errors.email))}
          placeholder="you@example.com"
        />
      </AuthField>

      <AuthField label="Password" error={errors.password}>
        <input
          type="password"
          autoComplete="new-password"
          value={values.password}
          onChange={(event) => {
            handleFieldChange('password', event.target.value);
          }}
          className={getAuthFieldClassName(Boolean(errors.password))}
          placeholder="Create a password"
        />
      </AuthField>

      <AuthField label="Confirm Password" error={errors.confirmPassword}>
        <input
          type="password"
          value={values.confirmPassword}
          autoComplete="new-password"
          onChange={(event) => {
            handleFieldChange('confirmPassword', event.target.value);
          }}
          className={getAuthFieldClassName(Boolean(errors.confirmPassword))}
          placeholder="Confirm your password"
        />
      </AuthField>

      <AppButton type="submit" disabled={isSubmitting} className="mt-1 min-h-10 text-[0.98rem]">
        {isSubmitting ? 'Creating account...' : 'Create account'}
      </AppButton>

      {errors.form ? <AuthFormError message={errors.form} /> : null}
    </form>
  );
}
