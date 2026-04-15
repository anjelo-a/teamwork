import type { Metadata } from 'next';
import '@fontsource-variable/space-grotesk';
import './globals.css';
import { loadInitialAuthSessionSnapshot } from '@/lib/api/server-bootstrap';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'TeamWork',
  description: 'Real-time collaboration workspace shell',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const initialSession = await loadInitialAuthSessionSnapshot();

  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">
        <Providers initialSession={initialSession}>{children}</Providers>
      </body>
    </html>
  );
}
