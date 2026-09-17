'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { dashboardFor, useAuth } from '@/lib/auth';
import { currentSlug, slugFromHost } from '@/lib/tenant';
import { Button, Field, Input, useToast } from '@/components/ui';

function LoginForm() {
  const { login, me, loading, role } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const [school, setSchool] = useState('');
  const [locked, setLocked] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const fromHost = slugFromHost(window.location.host);
    const s = fromHost || currentSlug();
    if (s) {
      setSchool(s);
      setLocked(!!fromHost);
    }
  }, []);
  useEffect(() => {
    if (!loading && me?.type === 'TENANT') router.replace(params.get('next') || dashboardFor(role));
  }, [me, loading, role, router, params]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const m = await login(school.trim(), email.trim(), password);
      router.replace(
        params.get('next') ||
          dashboardFor(
            m.user.userType === 'PARENT'
              ? 'parent'
              : m.user.userType === 'STUDENT'
                ? 'student'
                : (m.roles ?? []).some((r) => ['School Admin', 'Principal', 'Academic Head'].includes(r))
                  ? 'admin'
                  : (m.roles ?? []).some((r) => ['Accountant', 'Cashier'].includes(r))
                    ? 'finance'
                    : (m.roles ?? []).includes('Canteen Manager')
                      ? 'canteen'
                      : 'teacher',
          ),
      );
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="School code or address" hint={locked ? undefined : 'e.g. brightfuture or SCH-GH-000001'}>
        <Input
          value={school}
          onChange={(e) => setSchool(e.target.value)}
          required
          disabled={locked}
          placeholder="your-school"
        />
      </Field>
      <Field label="Email">
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" />
      </Field>
      <Field label="Password">
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
      </Field>
      <Button type="submit" className="w-full" loading={busy}>
        Sign in
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <img src="/icon.svg" alt="" className="mx-auto mb-3 h-12 w-12" />
          <h1 className="text-xl font-semibold text-slate-900">Sign in to your school</h1>
          <p className="text-sm text-slate-500">Staff, teachers, parents and students</p>
        </div>
        <div className="card p-6">
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
        <p className="mt-4 text-center text-xs text-slate-500">
          New school?{' '}
          <Link href="/register" className="font-medium text-brand">
            Register here
          </Link>{' '}
          ·{' '}
          <Link href="/platform/login" className="hover:underline">
            Platform console
          </Link>
        </p>
      </div>
    </div>
  );
}
