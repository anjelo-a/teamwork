import type { Metadata } from 'next';
import '@fontsource-variable/space-grotesk';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'TeamWork',
  description: 'Real-time collaboration workspace shell',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
