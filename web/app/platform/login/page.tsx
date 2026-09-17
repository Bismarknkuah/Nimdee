'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Button, Field, Input, useToast } from '@/components/ui';
import { api } from '@/lib/api';

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
    <div className="flex min-h-screen items-center justify-center bg-slate-900 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center text-white">
          <img src="/icon.svg" alt="" className="mx-auto mb-3 h-12 w-12" />
          <h1 className="text-xl font-semibold">Platform console</h1>
          <p className="text-sm text-slate-400">School OS owner &amp; support team</p>
        </div>
        <form onSubmit={submit} className="card space-y-4 p-6">
          <Field label="Email">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Field label="Password">
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </Field>
          <Button type="submit" className="w-full" loading={busy}>
            Sign in
          </Button>
          {demo && (
            <button
              type="button"
              onClick={demoLogin}
              disabled={busy}
              className="w-full rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-left text-sm hover:bg-brand-soft disabled:opacity-50"
            >
              <span className="block font-medium text-slate-900">Quick demo access — Platform owner</span>
              <span className="block text-xs text-slate-500">
                {demo.platform.email} · password {demo.password}
              </span>
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
