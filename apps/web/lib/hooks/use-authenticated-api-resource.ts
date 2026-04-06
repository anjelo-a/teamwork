'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuthSession } from '@/lib/auth/auth-session-provider';

interface UseAuthenticatedApiResourceOptions<T> {
  key: string;
  load: (accessToken: string) => Promise<T>;
}

type ResourceState<T> =
  | { status: 'loading'; data: null; error: null }
  | { status: 'success'; data: T; error: null }
  | { status: 'error'; data: null; error: Error };

interface StoredResourceState {
  requestKey: string | null;
  status: 'loading' | 'success' | 'error';
}

type StoredLoadingState = StoredResourceState & {
  status: 'loading';
  data: null;
  error: null;
};

type StoredSuccessState<T> = StoredResourceState & {
  requestKey: string;
  status: 'success';
  data: T;
  error: null;
};

type StoredErrorState = StoredResourceState & {
  requestKey: string;
  status: 'error';
  data: null;
  error: Error;
};

type StoredResourceResult<T> = StoredLoadingState | StoredSuccessState<T> | StoredErrorState;

export function useAuthenticatedApiResource<T>({
  key,
  load,
}: UseAuthenticatedApiResourceOptions<T>): ResourceState<T> {
  const { status, accessToken } = useAuthSession();
  const loadRef = useRef(load);
  const requestTokenRef = useRef<symbol | null>(null);
  const [state, setState] = useState<StoredResourceResult<T>>({
    requestKey: null,
    status: 'loading',
    data: null,
    error: null,
  });

  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  useEffect(() => {
    if (status !== 'authenticated' || !accessToken) {
      requestTokenRef.current = null;
      return;
    }

    const requestToken = Symbol(key);
    requestTokenRef.current = requestToken;

    void (async () => {
      try {
        const data = await loadRef.current(accessToken);

        if (requestTokenRef.current !== requestToken) {
          return;
        }

        setState({
          requestKey: key,
          status: 'success',
          data,
          error: null,
        });
      } catch (error) {
        if (requestTokenRef.current !== requestToken) {
          return;
        }

        setState({
          requestKey: key,
          status: 'error',
          data: null,
          error: error instanceof Error ? error : new Error('Request failed.'),
        });
      }
    })();

    return () => {
      if (requestTokenRef.current === requestToken) {
        requestTokenRef.current = null;
      }
    };
  }, [accessToken, key, status]);

  if (
    status !== 'authenticated' ||
    !accessToken ||
    state.requestKey !== key ||
    state.status === 'loading'
  ) {
    return {
      status: 'loading',
      data: null,
      error: null,
    };
  }

  if (state.status === 'error') {
    return {
      status: 'error',
      data: null,
      error: state.error,
    };
  }

  return {
    status: 'success',
    data: state.data,
    error: null,
  };
}
