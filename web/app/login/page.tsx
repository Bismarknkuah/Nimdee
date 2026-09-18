'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { dashboardFor, useAuth } from '@/lib/auth';
import { currentSlug, slugFromHost } from '@/lib/tenant';
import { Button, Field, Input, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import {
  Backpack,
  Building2,
  CloudOff,
  GraduationCap,
  HeartHandshake,
  Landmark,
  ShieldCheck,
  Smartphone,
  Sparkles,
  UsersRound,
  UtensilsCrossed,
  Wallet,
} from 'lucide-react';

const KIND_STYLE: Record<string, { icon: any; tone: string }> = {
  admin: { icon: ShieldCheck, tone: 'text-brand-dark bg-brand-soft' },
  teacher: { icon: GraduationCap, tone: 'text-emerald-700 bg-emerald-50' },
  finance: { icon: Landmark, tone: 'text-amber-700 bg-amber-50' },
  canteen: { icon: UtensilsCrossed, tone: 'text-orange-700 bg-orange-50' },
  staff: { icon: UsersRound, tone: 'text-violet-700 bg-violet-50' },
  parent: { icon: HeartHandshake, tone: 'text-sky-700 bg-sky-50' },
  student: { icon: Backpack, tone: 'text-rose-700 bg-rose-50' },
};

const LEFT_PANEL_POINTS = [
  { icon: CloudOff, text: 'Attendance keeps working when the internet doesn\u2019t' },
  { icon: ShieldCheck, text: 'Every school isolated at the database layer' },
  { icon: Wallet, text: 'Mobile Money & card payments, fully audited' },
  { icon: Smartphone, text: 'A portal parents actually check' },
];

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

  return (
    <div className="w-full max-w-md">
      <div className="mb-8 text-center lg:hidden">
        <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-brand-dark text-white shadow-card">
          <GraduationCap size={20} />
        </span>
        <p className="text-lg font-bold text-slate-900">Nimdee</p>
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Welcome back</h1>
      <p className="mt-1 text-sm text-slate-500">Sign in to your school&apos;s portal.</p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        {locked ? (
          <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm">
            <span className="flex items-center gap-2 text-slate-700">
              <Building2 size={15} className="text-slate-400" />
              Signing in to <span className="font-semibold">{school}</span>
            </span>
            <button type="button" onClick={() => setLocked(false)} className="text-xs font-medium text-brand hover:underline">
              Change
            </button>
          </div>
        ) : (
          <Field label="School code or address" hint="e.g. brightfuture or SCH-GH-000001">
            <Input value={school} onChange={(e) => setSchool(e.target.value)} required placeholder="your-school" />
          </Field>
        )}
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
        <Button type="submit" className="w-full py-2.5 text-[15px]" loading={busy}>
          Sign in
        </Button>
      </form>

      {demo && (!locked || school === demo.school.slug) && (
        <div className="mt-7">
          <div className="mb-4 flex items-center gap-3">
            <span className="h-px flex-1 bg-slate-200" />
            <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
              <Sparkles size={13} className="text-brand" /> Quick access &middot; demo
            </span>
            <span className="h-px flex-1 bg-slate-200" />
          </div>
          <p className="mb-3 text-center text-xs text-slate-500">
            Explore {demo.school.name} as any role &mdash; one click, no password needed.
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {demo.accounts.map((a: any) => {
              const style = KIND_STYLE[a.kind] ?? KIND_STYLE.staff;
              const Icon = style.icon;
              return (
                <button
                  key={a.email}
                  type="button"
                  disabled={busy}
                  onClick={() => doLogin(demo.school.slug, a.email, demo.password)}
                  className="group flex flex-col items-start gap-1.5 rounded-xl border border-slate-200 bg-white p-2.5 text-left transition hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md disabled:opacity-50"
                >
                  <span className={`flex h-7 w-7 items-center justify-center rounded-full ${style.tone}`}>
                    <Icon size={14} />
                  </span>
                  <span className="text-xs font-semibold leading-tight text-slate-900">{a.label}</span>
                  <span className="truncate text-[10px] leading-tight text-slate-400">{a.name}</span>
                </button>
              );
            })}
          </div>
          {demo.platform && (
            <Link
              href="/platform/login?demo=1"
              className="mt-4 flex items-center justify-center gap-1.5 text-xs font-medium text-brand hover:underline"
            >
              Or open the platform owner console &rarr;
            </Link>
          )}
        </div>
      )}

      <p className="mt-8 text-center text-xs text-slate-500">
        New school?{' '}
        <Link href="/register" className="font-semibold text-brand hover:underline">
          Register here
        </Link>{' '}
        &middot;{' '}
        <Link href="/platform/login" className="hover:underline">
          Platform console
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen bg-white">
      <div className="relative hidden w-[42%] flex-col justify-between overflow-hidden bg-gradient-to-br from-brand via-brand to-brand-dark p-12 text-white lg:flex">
        <div className="pointer-events-none absolute -left-16 -top-16 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-10 h-80 w-80 rounded-full bg-emerald-300/10 blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-2.5 font-bold">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
              <GraduationCap size={19} />
            </span>
            <span className="text-lg tracking-tight">Nimdee</span>
          </div>
          <h2 className="mt-14 max-w-sm text-3xl font-extrabold leading-tight tracking-tight">
            One platform for your whole school.
          </h2>
          <p className="mt-4 max-w-sm text-brand-soft/90">
            Academics, attendance, fees, canteen and a parent portal &mdash; built for KG, Primary and JHS schools,
            day and boarding.
          </p>
          <ul className="mt-10 space-y-4">
            {LEFT_PANEL_POINTS.map((p) => (
              <li key={p.text} className="flex items-center gap-3 text-sm text-white/90">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15">
                  <p.icon size={15} />
                </span>
                {p.text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-brand-soft/70">
          Built for Ghana&apos;s basic schools &mdash; KG, Primary &amp; JHS, day and boarding.
        </p>
      </div>
      <div className="flex flex-1 items-center justify-center p-6 sm:p-10">
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
