'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuthSession } from '@/lib/auth/auth-session-provider';

interface UseAuthenticatedApiResourceOptions<T> {
  key: string;
  load: (accessToken: string) => Promise<T>;
  cacheTtlMs?: number;
  useStaleWhileRevalidate?: boolean;
  initialData?: T | null;
  enabled?: boolean;
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
  cacheTtlMs = 0,
  useStaleWhileRevalidate = false,
  initialData = null,
  enabled = true,
}: UseAuthenticatedApiResourceOptions<T>): ResourceState<T> {
  const { status, accessToken } = useAuthSession();
  const loadRef = useRef(load);
  const requestTokenRef = useRef<symbol | null>(null);
  const cacheRef = useRef(
    new Map<
      string,
      {
        expiresAt: number;
        data: T;
      }
    >(),
  );
  const inflightRequestRef = useRef(new Map<string, Promise<T>>());
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
    if (!enabled || status !== 'authenticated' || !accessToken) {
      requestTokenRef.current = null;
      return;
    }

    const cacheKey = `${key}::${accessToken}`;
    const requestToken = Symbol(cacheKey);
    requestTokenRef.current = requestToken;
    const existingCacheEntry = cacheRef.current.get(cacheKey);

    if (initialData !== null && !existingCacheEntry) {
      cacheRef.current.set(cacheKey, {
        // Keep initial payload available as stale fallback for SWR revalidation failures.
        expiresAt: cacheTtlMs > 0 ? Date.now() + cacheTtlMs : Date.now(),
        data: initialData,
      });
    }

    const cachedEntry = cacheRef.current.get(cacheKey);
    const cachedData =
      cachedEntry && cachedEntry.expiresAt > Date.now() ? cachedEntry.data : null;

    if (cachedData !== null) {
      queueMicrotask(() => {
        if (requestTokenRef.current !== requestToken) {
          return;
        }

        setState({
          requestKey: key,
          status: 'success',
          data: cachedData,
          error: null,
        });
      });

      if (!useStaleWhileRevalidate) {
        return () => {
          if (requestTokenRef.current === requestToken) {
            requestTokenRef.current = null;
          }
        };
      }
    } else if (initialData !== null) {
      queueMicrotask(() => {
        if (requestTokenRef.current !== requestToken) {
          return;
        }

        setState({
          requestKey: key,
          status: 'success',
          data: initialData,
          error: null,
        });
      });
    }

    void (async () => {
      try {
        const activeInflightRequest = inflightRequestRef.current.get(cacheKey);
        const request =
          activeInflightRequest ??
          loadRef.current(accessToken).then((data) => {
            if (cacheTtlMs > 0) {
              cacheRef.current.set(cacheKey, {
                expiresAt: Date.now() + cacheTtlMs,
                data,
              });
            }

            return data;
          });

        if (!activeInflightRequest) {
          inflightRequestRef.current.set(cacheKey, request);
          void request.finally(() => {
            if (inflightRequestRef.current.get(cacheKey) === request) {
              inflightRequestRef.current.delete(cacheKey);
            }
          });
        }

        const data = await request;

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

        const staleCachedData = cacheRef.current.get(cacheKey)?.data ?? null;
        if (useStaleWhileRevalidate && staleCachedData !== null) {
          setState({
            requestKey: key,
            status: 'success',
            data: staleCachedData,
            error: null,
          });
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
  }, [accessToken, cacheTtlMs, enabled, initialData, key, status, useStaleWhileRevalidate]);

  if (!enabled || status !== 'authenticated' || !accessToken) {
    return {
      status: 'loading',
      data: null,
      error: null,
    };
  }

  if (state.requestKey === key && state.status === 'error') {
    return {
      status: 'error',
      data: null,
      error: state.error,
    };
  }

  if (state.requestKey === key && state.status === 'success') {
    return {
      status: 'success',
      data: state.data,
      error: null,
    };
  }

  if (initialData !== null) {
    return {
      status: 'success',
      data: initialData,
      error: null,
    };
  }

  return {
    status: 'loading',
    data: null,
    error: null,
  };
}
