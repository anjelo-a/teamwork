import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AuthMeResponse, AuthenticatedWorkspace } from '@teamwork/types';
import type * as ApiClientModule from '@/lib/api/client';
import { login, register } from '@/lib/api/client';
import { SignInForm } from '@/components/auth/sign-in-form';
import { SignUpForm } from '@/components/auth/sign-up-form';
import { useAuthSession } from '@/lib/auth/auth-session-provider';

const replaceMock = jest.fn();
let nextPath: string | null = null;

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: replaceMock,
    push: jest.fn(),
  }),
  useSearchParams: () => ({
    get: (key: string) => (key === 'next' ? nextPath : null),
  }),
}));

jest.mock('@/lib/api/client', () => {
  const actual = jest.requireActual<typeof ApiClientModule>('@/lib/api/client');

  return {
    ...actual,
    login: jest.fn(),
    register: jest.fn(),
  };
});

jest.mock('@/lib/auth/auth-session-provider', () => ({
  useAuthSession: jest.fn(),
}));

const mockedLogin = jest.mocked(login);
const mockedRegister = jest.mocked(register);
const mockedUseAuthSession = jest.mocked(useAuthSession);

const EMPTY_AUTH: AuthMeResponse = {
  user: {
    id: '',
    email: '',
    displayName: '',
    createdAt: '',
    updatedAt: '',
  },
  workspaces: [],
  activeWorkspace: null,
};

function buildWorkspace(id: string): AuthenticatedWorkspace {
  return {
    id,
    name: 'Product Workspace',
    slug: 'product-workspace',
    createdByUserId: 'user-owner',
    createdAt: '2026-04-10T00:00:00.000Z',
    updatedAt: '2026-04-10T00:00:00.000Z',
    membership: {
      id: `membership-${id}`,
      workspaceId: id,
      userId: 'user-owner',
      role: 'owner',
      createdAt: '2026-04-10T00:00:00.000Z',
    },
  };
}

function buildAuth(workspaceId = 'workspace-1'): AuthMeResponse {
  const workspace = buildWorkspace(workspaceId);

  return {
    user: {
      id: 'user-owner',
      email: 'owner@example.com',
      displayName: 'Owner Person',
      createdAt: '2026-04-10T00:00:00.000Z',
      updatedAt: '2026-04-10T00:00:00.000Z',
    },
    workspaces: [workspace],
    activeWorkspace: workspace,
  };
}

function configureSessionMock(
  refreshResult: Awaited<ReturnType<ReturnType<typeof useAuthSession>['refreshSession']>>,
) {
  mockedUseAuthSession.mockReturnValue({
    status: 'authenticated',
    auth: buildAuth(),
    accessToken: 'token-123',
    errorMessage: null,
    refreshSession: jest.fn().mockResolvedValue(refreshResult),
    setAccessToken: jest.fn(),
    clearSession: jest.fn(),
  });
}

describe('auth forms', () => {
  beforeEach(() => {
    mockedLogin.mockReset();
    mockedRegister.mockReset();
    mockedUseAuthSession.mockReset();
    replaceMock.mockReset();
    nextPath = null;
  });

  describe('SignInForm', () => {
    it('shows validation errors for empty required fields', async () => {
      configureSessionMock({
        status: 'authenticated',
        auth: buildAuth(),
        accessToken: 'token-123',
        errorMessage: null,
      });
      const user = userEvent.setup();

      render(<SignInForm />);
      await user.click(screen.getByRole('button', { name: 'Sign in' }));

      expect(screen.getByText('Email is required.')).toBeInTheDocument();
      expect(screen.getByText('Password is required.')).toBeInTheDocument();
      expect(mockedLogin).not.toHaveBeenCalled();
    });

    it('logs in and redirects to next path when provided', async () => {
      const user = userEvent.setup();
      nextPath = '/workspaces/workspace-next/calendar';
      configureSessionMock({
        status: 'authenticated',
        auth: buildAuth('workspace-next'),
        accessToken: 'token-123',
        errorMessage: null,
      });
      mockedLogin.mockResolvedValue({
        user: buildAuth().user,
        workspaces: buildAuth().workspaces,
        accessToken: 'token-123',
      });

      render(<SignInForm />);

      await user.type(screen.getByPlaceholderText('you@example.com'), ' OWNER@EXAMPLE.COM ');
      await user.type(screen.getByPlaceholderText('Enter your password'), 'Passw0rd!');
      await user.click(screen.getByRole('button', { name: 'Sign in' }));

      await waitFor(() => {
        expect(mockedLogin).toHaveBeenCalledWith({
          email: 'owner@example.com',
          password: 'Passw0rd!',
        });
      });
      expect(replaceMock).toHaveBeenCalledWith('/workspaces/workspace-next/calendar');
    });

    it('shows a session restoration error when refresh does not authenticate', async () => {
      const user = userEvent.setup();
      configureSessionMock({
        status: 'unauthenticated',
        auth: EMPTY_AUTH,
        accessToken: null,
        errorMessage: 'Session is unavailable.',
      });
      mockedLogin.mockResolvedValue({
        user: buildAuth().user,
        workspaces: buildAuth().workspaces,
        accessToken: 'token-123',
      });

      render(<SignInForm />);

      await user.type(screen.getByPlaceholderText('you@example.com'), 'owner@example.com');
      await user.type(screen.getByPlaceholderText('Enter your password'), 'Passw0rd!');
      await user.click(screen.getByRole('button', { name: 'Sign in' }));

      expect(await screen.findByText('Session is unavailable.')).toBeInTheDocument();
      expect(replaceMock).not.toHaveBeenCalled();
    });
  });

  describe('SignUpForm', () => {
    it('shows validation errors when passwords do not match', async () => {
      configureSessionMock({
        status: 'authenticated',
        auth: buildAuth(),
        accessToken: 'token-123',
        errorMessage: null,
      });
      const user = userEvent.setup();

      render(<SignUpForm />);

      await user.type(screen.getByPlaceholderText('Your full name'), 'Owner Person');
      await user.type(screen.getByPlaceholderText('you@example.com'), 'owner@example.com');
      await user.type(screen.getByPlaceholderText('Create a password'), 'Passw0rd!');
      await user.type(screen.getByPlaceholderText('Confirm your password'), 'Passw0rd?');
      await user.click(screen.getByRole('button', { name: 'Create account' }));

      expect(screen.getByText('Passwords must match.')).toBeInTheDocument();
      expect(mockedRegister).not.toHaveBeenCalled();
    });

    it('registers and redirects to the created workspace board by default', async () => {
      const user = userEvent.setup();
      configureSessionMock({
        status: 'authenticated',
        auth: buildAuth('workspace-created'),
        accessToken: 'token-123',
        errorMessage: null,
      });
      mockedRegister.mockResolvedValue({
        user: buildAuth().user,
        workspace: buildWorkspace('workspace-created'),
        memberships: [buildWorkspace('workspace-created').membership],
        workspaces: [buildWorkspace('workspace-created')],
        accessToken: 'token-123',
      });

      render(<SignUpForm />);

      await user.type(screen.getByPlaceholderText('Your full name'), '  Owner   Person  ');
      await user.type(screen.getByPlaceholderText('you@example.com'), 'OWNER@EXAMPLE.COM');
      await user.type(screen.getByPlaceholderText('Create a password'), 'Passw0rd!');
      await user.type(screen.getByPlaceholderText('Confirm your password'), 'Passw0rd!');
      await user.click(screen.getByRole('button', { name: 'Create account' }));

      await waitFor(() => {
        expect(mockedRegister).toHaveBeenCalledWith({
          displayName: 'Owner Person',
          email: 'owner@example.com',
          password: 'Passw0rd!',
        });
      });
      expect(replaceMock).toHaveBeenCalledWith('/workspaces/workspace-created/board');
    });
  });
});
