import type { ReactNode } from 'react';
import { AppShell } from '@/components/app-shell/app-shell';

export const preferredRegion = 'sin1';

interface AuthenticatedLayoutProps {
  children: ReactNode;
}

export default function AuthenticatedLayout({
  children,
}: AuthenticatedLayoutProps): ReactNode {
  return <AppShell>{children}</AppShell>;
}
