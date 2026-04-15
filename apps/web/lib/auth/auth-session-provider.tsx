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
import { ApiError, getAuthMe, logoutAuthSession, refreshAuthSession } from '@/lib/api/client';
import { COOKIE_SESSION_MARKER_PREFIX } from '@/lib/auth/session-constants';
import {
  clearLegacyStoredAccessToken,
  getLegacyStoredAccessToken,
  setLegacyStoredAccessToken,
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
  refreshSession: () => Promise<AuthSessionResult>;
  setAccessToken: (token: string) => Promise<AuthSessionResult>;
  clearSession: () => void;
}

export interface AuthSessionBootstrapState {
  status: 'authenticated' | 'unauthenticated';
  auth: AuthMeResponse;
  accessToken: string | null;
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

export function AuthSessionProvider({
  children,
  initialSession = null,
}: {
  children: ReactNode;
  initialSession?: AuthSessionBootstrapState | null;
}) {
  const [status, setStatus] = useState<AuthStatus>(initialSession?.status ?? 'loading');
  const [auth, setAuth] = useState(initialSession?.auth ?? EMPTY_AUTH);
  const [accessToken, setAccessTokenState] = useState<string | null>(
    initialSession?.accessToken ?? null,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (initialSession) {
      return;
    }

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
  }, [initialSession]);

  const contextValue = useMemo(
    (): AuthSessionContextValue => ({
      status,
      auth,
      accessToken,
      errorMessage,
      refreshSession: async () => {
        setStatus('loading');
        setErrorMessage(null);
        const nextState = await resolveSessionState(
          accessToken && !isCookieSessionMarker(accessToken) ? accessToken : null,
        );
        applyResolvedSessionState(nextState, {
          setStatus,
          setAuth,
          setAccessTokenState,
          setErrorMessage,
        });
        return nextState;
      },
      setAccessToken: async (token: string) => {
        setStatus('loading');
        setErrorMessage(null);
        const nextState = await resolveSessionState(token);
        if (
          nextState.status === 'authenticated' &&
          nextState.accessToken &&
          !isCookieSessionMarker(nextState.accessToken)
        ) {
          setLegacyStoredAccessToken(nextState.accessToken);
        }
        applyResolvedSessionState(nextState, {
          setStatus,
          setAuth,
          setAccessTokenState,
          setErrorMessage,
        });
        return nextState;
      },
      clearSession: () => {
        void logoutAuthSession().catch(() => {
          // Best effort cleanup only.
        });
        clearLegacyStoredAccessToken();
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
  const legacyToken = tokenOverride ?? getLegacyStoredAccessToken();

  if (legacyToken) {
    try {
      const nextAuth = await getAuthMe(legacyToken);
      return {
        status: 'authenticated',
        auth: nextAuth,
        accessToken: legacyToken,
        errorMessage: null,
      };
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        clearLegacyStoredAccessToken();
      } else {
        return {
          status: 'error',
          auth: EMPTY_AUTH,
          accessToken: legacyToken,
          errorMessage: error instanceof Error ? error.message : 'Session request failed.',
        };
      }
    }
  }

  try {
    const nextAuth = await getAuthMe();
    return {
      status: 'authenticated',
      auth: nextAuth,
      accessToken: buildCookieSessionMarker(nextAuth),
      errorMessage: null,
    };
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      const refreshed = await refreshAuthSession();

      if (refreshed) {
        try {
          const nextAuth = await getAuthMe();
          return {
            status: 'authenticated',
            auth: nextAuth,
            accessToken: buildCookieSessionMarker(nextAuth),
            errorMessage: null,
          };
        } catch {
          // Fall through to unauthenticated below.
        }
      }

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
      accessToken: null,
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

function buildCookieSessionMarker(auth: AuthMeResponse): string {
  return `${COOKIE_SESSION_MARKER_PREFIX}:${auth.user.id}:${auth.user.updatedAt}`;
}

function isCookieSessionMarker(token: string): boolean {
  return token.startsWith(`${COOKIE_SESSION_MARKER_PREFIX}:`);
}
