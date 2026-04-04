'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { ContentPanel } from '@/components/app-shell/page-state';

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  helperText: string;
  helperHref: string;
  helperLabel: string;
  children: ReactNode;
}

export function AuthLayout({
  title,
  subtitle,
  helperText,
  helperHref,
  helperLabel,
  children,
}: AuthLayoutProps) {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-[440px]">
        <div className="text-center">
          <h1 className="text-[2.7rem] font-semibold tracking-tight text-foreground">{title}</h1>
          <p className="mt-2 text-[1rem] text-muted">{subtitle}</p>
        </div>

        <ContentPanel className="shell-panel mt-7 px-6 py-7">
          {children}

          <p className="mt-5 text-center text-[0.92rem] text-muted">
            {helperText}{' '}
            <Link href={helperHref} className="font-semibold text-foreground transition-colors hover:text-accent">
              {helperLabel}
            </Link>
          </p>
        </ContentPanel>
      </div>
    </main>
  );
}
