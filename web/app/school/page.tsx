'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { dashboardFor, useAuth } from '@/lib/auth';
import { Spinner } from '@/components/ui';

/** Sends every user to the dashboard for their role. */
export default function SchoolHome() {
  const { role, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!loading && role) router.replace(dashboardFor(role));
  }, [role, loading, router]);
  return <Spinner />;
}
