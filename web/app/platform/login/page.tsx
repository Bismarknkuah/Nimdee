'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Button, Field, Input, useToast } from '@/components/ui';
import { api } from '@/lib/api';
import { GraduationCap, ShieldCheck, Sparkles } from 'lucide-react';

export default function PlatformLogin() {
  const { platformLogin, me, loading } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [demo, setDemo] = useState<any>(null);
  useEffect(() => {
    api.public
      .get('/public/demo-accounts')
      .then((d) => d?.enabled && d.platform && setDemo(d))
      .catch(() => undefined);
  }, []);
  const demoLogin = async () => {
    setBusy(true);
    try {
      await platformLogin(demo.platform.email, demo.password);
      router.replace('/platform');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    if (!loading && me?.type === 'PLATFORM') router.replace('/platform');
  }, [me, loading, router]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await platformLogin(email.trim(), password);
      router.replace('/platform');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 p-4">
      <div className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-brand/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 -right-16 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />
      <div className="relative w-full max-w-sm">
        <div className="mb-7 text-center text-white">
          <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-brand-dark shadow-lg shadow-brand/30">
            <GraduationCap size={22} />
          </span>
          <h1 className="text-xl font-semibold tracking-tight">Platform console</h1>
          <p className="mt-1 text-sm text-slate-400">Nimdee owner &amp; support team</p>
        </div>
        <form onSubmit={submit} className="glass space-y-4 rounded-2xl p-6 shadow-2xl">
          <Field label="Email">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Field label="Password">
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </Field>
          <Button type="submit" className="w-full py-2.5" loading={busy}>
            Sign in
          </Button>
          {demo && (
            <button
              type="button"
              onClick={demoLogin}
              disabled={busy}
              className="flex w-full items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-white/60 px-3 py-2.5 text-left transition hover:border-brand/50 hover:bg-brand-soft/60 disabled:opacity-50"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-dark">
                <ShieldCheck size={15} />
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-1 text-sm font-semibold text-slate-900">
                  <Sparkles size={12} className="text-brand" /> Quick demo access
                </span>
                <span className="block truncate text-xs text-slate-500">{demo.platform.email}</span>
              </span>
            </button>
          )}
        </form>
        <p className="relative mt-6 text-center text-xs text-slate-500">
          Not a platform account? <Link href="/login" className="font-medium text-slate-300 hover:underline">School sign in</Link>
        </p>
      </div>
    </div>
  );
}
