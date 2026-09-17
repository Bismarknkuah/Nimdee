'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { dashboardFor, useAuth } from '@/lib/auth';
import { currentSlug, slugFromHost } from '@/lib/tenant';
import { Button, Field, Input, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { Sparkles } from 'lucide-react';

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
  const [demo, setDemo] = useState<any>(null);
  useEffect(() => {
    api.public
      .get('/public/demo-accounts')
      .then((d) => d?.enabled && setDemo(d))
      .catch(() => undefined);
  }, []);
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

  const doLogin = async (slug: string, mail: string, pass: string) => {
    setBusy(true);
    try {
      const m = await login(slug.trim(), mail.trim(), pass);
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
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    doLogin(school, email, password);
  };
  const tones: Record<string, string> = {
    admin: 'border-brand/40 hover:bg-brand-soft',
    teacher: 'border-emerald-200 hover:bg-emerald-50',
    finance: 'border-amber-200 hover:bg-amber-50',
    canteen: 'border-orange-200 hover:bg-orange-50',
    staff: 'border-violet-200 hover:bg-violet-50',
    parent: 'border-sky-200 hover:bg-sky-50',
    student: 'border-pink-200 hover:bg-pink-50',
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
      {demo && (!locked || school === demo.school.slug) && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600">
            <Sparkles size={14} className="text-brand" /> Quick demo access — {demo.school.name}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            One click signs you in as that user (password {demo.password}).
          </p>
          <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {demo.accounts.map((a: any) => (
              <button
                key={a.email}
                type="button"
                disabled={busy}
                onClick={() => doLogin(demo.school.slug, a.email, demo.password)}
                className={`rounded-lg border bg-white px-2 py-1.5 text-left text-xs transition disabled:opacity-50 ${tones[a.kind] ?? tones.staff}`}
              >
                <span className="block font-medium text-slate-900">{a.label}</span>
                <span className="block truncate text-[11px] text-slate-500">{a.name}</span>
              </button>
            ))}
          </div>
          {demo.platform && (
            <Link href="/platform/login?demo=1" className="mt-2 block text-xs text-brand hover:underline">
              Platform owner console →
            </Link>
          )}
        </div>
      )}
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
