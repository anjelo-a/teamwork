import {
  DISPLAY_NAME_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  normalizeEmail,
} from '@teamwork/validation';

const SIMPLE_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface SignInFormValues {
  email: string;
  password: string;
}

export interface SignUpFormValues extends SignInFormValues {
  name: string;
  confirmPassword: string;
}

export type SignInFieldName = 'email' | 'password' | 'form';
export type SignUpFieldName = 'name' | 'email' | 'password' | 'confirmPassword' | 'form';

export type SignInErrors = Partial<Record<SignInFieldName, string>>;
export type SignUpErrors = Partial<Record<SignUpFieldName, string>>;

export function validateSignInInput(values: SignInFormValues): {
  input: { email: string; password: string } | null;
  errors: SignInErrors;
} {
  const email = normalizeEmail(values.email);
  const password = values.password;
  const errors: SignInErrors = {};

  if (!email) {
    errors.email = 'Email is required.';
  } else if (!SIMPLE_EMAIL_PATTERN.test(email)) {
    errors.email = 'Enter a valid email address.';
  }

  if (!password) {
    errors.password = 'Password is required.';
  } else if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
    errors.password = `Password must be ${String(PASSWORD_MIN_LENGTH)}-${String(PASSWORD_MAX_LENGTH)} characters.`;
  }

  if (Object.keys(errors).length > 0) {
    return {
      input: null,
      errors,
    };
  }

  return {
    input: {
      email,
      password,
    },
    errors,
  };
}

export function validateSignUpInput(values: SignUpFormValues): {
  input:
    | {
        displayName: string;
        email: string;
        password: string;
      }
    | null;
  errors: SignUpErrors;
} {
  const displayName = normalizeWhitespace(values.name);
  const email = normalizeEmail(values.email);
  const password = values.password;
  const confirmPassword = values.confirmPassword;
  const errors: SignUpErrors = {};

  if (!displayName) {
    errors.name = 'Name is required.';
  } else if (displayName.length < 2 || displayName.length > DISPLAY_NAME_MAX_LENGTH) {
    errors.name = `Name must be 2-${String(DISPLAY_NAME_MAX_LENGTH)} characters.`;
  }

  if (!email) {
    errors.email = 'Email is required.';
  } else if (!SIMPLE_EMAIL_PATTERN.test(email)) {
    errors.email = 'Enter a valid email address.';
  }

  if (!password) {
    errors.password = 'Password is required.';
  } else if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
    errors.password = `Password must be ${String(PASSWORD_MIN_LENGTH)}-${String(PASSWORD_MAX_LENGTH)} characters.`;
  }

  if (!confirmPassword) {
    errors.confirmPassword = 'Confirm password is required.';
  } else if (confirmPassword !== password) {
    errors.confirmPassword = 'Passwords must match.';
  }

  if (Object.keys(errors).length > 0) {
    return {
      input: null,
      errors,
    };
  }

  return {
    input: {
      displayName,
      email,
      password,
    },
    errors,
  };
}

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}
