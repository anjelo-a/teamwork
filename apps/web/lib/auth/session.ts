import { ACCESS_TOKEN_COOKIE_KEY, ACCESS_TOKEN_STORAGE_KEY } from './session-constants';

export function getStoredAccessToken(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const token = window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
  return token && token.trim().length > 0 ? token : null;
}

export function setStoredAccessToken(token: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token);
  document.cookie = `${ACCESS_TOKEN_COOKIE_KEY}=${encodeURIComponent(token)}; Path=/; Max-Age=604800; SameSite=Lax${window.location.protocol === 'https:' ? '; Secure' : ''}`;
}

export function clearStoredAccessToken(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  document.cookie = `${ACCESS_TOKEN_COOKIE_KEY}=; Path=/; Max-Age=0; SameSite=Lax${window.location.protocol === 'https:' ? '; Secure' : ''}`;
}
