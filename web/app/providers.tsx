'use client';
import { useEffect } from 'react';
import { AuthProvider } from '@/lib/auth';
import { ToastProvider } from '@/components/ui';

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production')
      navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  }, []);
  return (
    <ToastProvider>
      <AuthProvider>{children}</AuthProvider>
    </ToastProvider>
  );
}
