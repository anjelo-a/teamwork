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

const SHARED_RESOURCE_CACHE = new Map<
  string,
  {
    expiresAt: number;
    data: unknown;
  }
>();
const INFLIGHT_RESOURCE_REQUESTS = new Map<string, Promise<unknown>>();

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
    const cachedData = readFreshCachedValue<T>(cacheKey);

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
        const data = await loadResourceWithDedupe(cacheKey, () => loadRef.current(accessToken), cacheTtlMs);

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

        const staleCachedData = readStaleCachedValue<T>(cacheKey);
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

function readFreshCachedValue<T>(cacheKey: string): T | null {
  const cachedEntry = SHARED_RESOURCE_CACHE.get(cacheKey);

  if (!cachedEntry) {
    return null;
  }

  if (cachedEntry.expiresAt <= Date.now()) {
    SHARED_RESOURCE_CACHE.delete(cacheKey);
    return null;
  }

  return cachedEntry.data as T;
}

function readStaleCachedValue<T>(cacheKey: string): T | null {
  const cachedEntry = SHARED_RESOURCE_CACHE.get(cacheKey);
  return cachedEntry ? (cachedEntry.data as T) : null;
}

async function loadResourceWithDedupe<T>(
  cacheKey: string,
  load: () => Promise<T>,
  cacheTtlMs: number,
): Promise<T> {
  const inflightRequest = INFLIGHT_RESOURCE_REQUESTS.get(cacheKey);

  if (inflightRequest) {
    return inflightRequest as Promise<T>;
  }

  const request = load().then((data) => {
    if (cacheTtlMs > 0) {
      SHARED_RESOURCE_CACHE.set(cacheKey, {
        expiresAt: Date.now() + cacheTtlMs,
        data,
      });
    }

    return data;
  });

  INFLIGHT_RESOURCE_REQUESTS.set(cacheKey, request as Promise<unknown>);

  request.finally(() => {
    if (INFLIGHT_RESOURCE_REQUESTS.get(cacheKey) === request) {
      INFLIGHT_RESOURCE_REQUESTS.delete(cacheKey);
    }
  });

  return request;
}
