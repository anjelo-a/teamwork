'use client';

import type { ReactNode } from 'react';
import { AuthSessionProvider } from '@/lib/auth/auth-session-provider';
import { AppShellActionProvider } from '@/lib/app-shell-action-context';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <AuthSessionProvider>
      <AppShellActionProvider>{children}</AppShellActionProvider>
    </AuthSessionProvider>
  );
}
