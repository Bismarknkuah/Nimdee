'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Button, Field, Input, useToast } from '@/components/ui';

export default function PlatformLogin() {
  const { platformLogin, me, loading } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
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
        </form>
      </div>
    </div>
  );
}
