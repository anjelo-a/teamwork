'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { AuthMeResponse } from '@teamwork/types';
import { ApiError, getAuthMe } from '@/lib/api/client';
import {
  clearStoredAccessToken,
  getStoredAccessToken,
  setStoredAccessToken,
} from '@/lib/auth/session';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'error';

export interface AuthSessionResult {
  status: AuthStatus;
  auth: AuthMeResponse;
  accessToken: string | null;
  errorMessage: string | null;
}

interface AuthSessionContextValue {
  status: AuthStatus;
  auth: AuthMeResponse;
  accessToken: string | null;
  errorMessage: string | null;
  refreshSession: () => Promise<void>;
  setAccessToken: (token: string) => Promise<AuthSessionResult>;
  clearSession: () => void;
}

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

const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);

export function AuthSessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [auth, setAuth] = useState(EMPTY_AUTH);
  const [accessToken, setAccessTokenState] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    void resolveSessionState().then((nextState) => {
      if (!isActive) {
        return;
      }

      applyResolvedSessionState(nextState, {
        setStatus,
        setAuth,
        setAccessTokenState,
        setErrorMessage,
      });
    });

    return () => {
      isActive = false;
    };
  }, []);

  const contextValue = useMemo(
    (): AuthSessionContextValue => ({
      status,
      auth,
      accessToken,
      errorMessage,
      refreshSession: async () => {
        setStatus('loading');
        setErrorMessage(null);
        const nextState = await resolveSessionState(accessToken);
        applyResolvedSessionState(nextState, {
          setStatus,
          setAuth,
          setAccessTokenState,
          setErrorMessage,
        });
      },
      setAccessToken: async (token: string) => {
        setStoredAccessToken(token);
        setStatus('loading');
        setErrorMessage(null);
        const nextState = await resolveSessionState(token);
        applyResolvedSessionState(nextState, {
          setStatus,
          setAuth,
          setAccessTokenState,
          setErrorMessage,
        });
        return nextState;
      },
      clearSession: () => {
        clearStoredAccessToken();
        setAuth(EMPTY_AUTH);
        setAccessTokenState(null);
        setErrorMessage(null);
        setStatus('unauthenticated');
      },
    }),
    [accessToken, auth, errorMessage, status],
  );

  return <AuthSessionContext.Provider value={contextValue}>{children}</AuthSessionContext.Provider>;
}

async function resolveSessionState(tokenOverride?: string | null): Promise<AuthSessionResult> {
  const token = tokenOverride ?? getStoredAccessToken();

  if (!token) {
    return {
      status: 'unauthenticated',
      auth: EMPTY_AUTH,
      accessToken: null,
      errorMessage: null,
    };
  }

  try {
    // Ensure SSR-aware auth cookie stays aligned with localStorage token for future server renders.
    setStoredAccessToken(token);
    const nextAuth = await getAuthMe(token);
    return {
      status: 'authenticated',
      auth: nextAuth,
      accessToken: token,
      errorMessage: null,
    };
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      clearStoredAccessToken();
      return {
        status: 'unauthenticated',
        auth: EMPTY_AUTH,
        accessToken: null,
        errorMessage: null,
      };
    }

    return {
      status: 'error',
      auth: EMPTY_AUTH,
      accessToken: token,
      errorMessage: error instanceof Error ? error.message : 'Session request failed.',
    };
  }
}

function applyResolvedSessionState(
  nextState: AuthSessionResult,
  setters: {
    setStatus: (status: AuthStatus) => void;
    setAuth: (auth: AuthMeResponse) => void;
    setAccessTokenState: (accessToken: string | null) => void;
    setErrorMessage: (errorMessage: string | null) => void;
  },
): void {
  setters.setStatus(nextState.status);
  setters.setAuth(nextState.auth);
  setters.setAccessTokenState(nextState.accessToken);
  setters.setErrorMessage(nextState.errorMessage);
}

export function useAuthSession(): AuthSessionContextValue {
  const value = useContext(AuthSessionContext);

  if (!value) {
    throw new Error('useAuthSession must be used within AuthSessionProvider.');
  }

  return value;
}
