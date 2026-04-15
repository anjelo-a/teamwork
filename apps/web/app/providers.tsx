'use client';

import type { ReactNode } from 'react';
import {
  AuthSessionProvider,
  type AuthSessionBootstrapState,
} from '@/lib/auth/auth-session-provider';
import { AppShellActionProvider } from '@/lib/app-shell-action-context';

interface ProvidersProps {
  children: ReactNode;
  initialSession?: AuthSessionBootstrapState | null;
}

export function Providers({ children, initialSession = null }: ProvidersProps) {
  return (
    <AuthSessionProvider initialSession={initialSession}>
      <AppShellActionProvider>{children}</AppShellActionProvider>
    </AuthSessionProvider>
  );
}
