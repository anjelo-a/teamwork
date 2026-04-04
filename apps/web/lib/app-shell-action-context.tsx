'use client';

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { ShellHeaderAction } from '@/lib/app-shell';

interface AppShellActionContextValue {
  actionOverride: ShellHeaderAction | null;
  setActionOverride: (action: ShellHeaderAction | null) => void;
}

const AppShellActionContext = createContext<AppShellActionContextValue | null>(null);

export function AppShellActionProvider({ children }: { children: ReactNode }) {
  const [actionOverride, setActionOverride] = useState<ShellHeaderAction | null>(null);

  const value = useMemo(
    () => ({
      actionOverride,
      setActionOverride,
    }),
    [actionOverride],
  );

  return (
    <AppShellActionContext.Provider value={value}>{children}</AppShellActionContext.Provider>
  );
}

export function useAppShellAction(): AppShellActionContextValue {
  const value = useContext(AppShellActionContext);

  if (!value) {
    throw new Error('useAppShellAction must be used within AppShellActionProvider.');
  }

  return value;
}
