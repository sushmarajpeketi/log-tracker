import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';

export const metadata: Metadata = {
  title: 'Log Explorer',
  description: 'HTTP request/response log viewer',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-gray-50 dark:bg-[#0f1117] text-gray-900 dark:text-gray-100 min-h-screen">
        <Providers>
          <Sidebar />
          <Topbar />
          <main className="ml-16 pt-12 min-h-screen">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
