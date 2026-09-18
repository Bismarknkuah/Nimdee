'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { portalUrlFor } from '@/lib/tenant';
import { Alert, Button, Checkbox, Field, Input, Select, useToast } from '@/components/ui';
import { money } from '@/lib/format';

const REGIONS = [
  'Greater Accra',
  'Ashanti',
  'Western',
  'Western North',
  'Central',
  'Eastern',
  'Volta',
  'Oti',
  'Northern',
  'North East',
  'Savannah',
  'Upper East',
  'Upper West',
  'Bono',
  'Bono East',
  'Ahafo',
];

export default function RegisterSchool() {
  const toast = useToast();
  const [plans, setPlans] = useState<any[]>([]);
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<any>(null);
  const [f, setF] = useState<any>({
    name: '',
    slug: '',
    type: 'BASIC',
    levels: ['KG', 'PRIMARY', 'JHS'],
    residency: 'DAY',
    region: '',
    district: '',
    address: '',
    phone: '',
    email: '',
    adminFirstName: '',
    adminLastName: '',
    adminEmail: '',
    adminPassword: '',
    planCode: 'STARTER',
    agree: false,
  });
  const set = (k: string) => (e: any) =>
    setF({ ...f, [k]: e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e });
  useEffect(() => {
    api.public
      .get('/public/plans')
      .then(setPlans)
      .catch(() => undefined);
  }, []);
  const slugPreview = (f.slug || f.name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);

  const submit = async () => {
    if (!f.agree) return toast.error('Please accept the terms to continue');
    if (!f.levels.length) return toast.error('Select at least one level (KG, Primary or JHS)');
    setBusy(true);
    try {
      const { agree, ...body } = f;
      if (!body.slug) delete body.slug;
      const r = await api.public.post('/public/schools/register', body);
      setDone(r);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (done)
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="card max-w-lg p-8 text-center">
          <h1 className="text-2xl font-semibold text-slate-900">Welcome, {done.school.name}!</h1>
          <p className="mt-2 text-slate-600">{done.message}</p>
          <div className="mt-6 rounded-lg bg-slate-50 p-4 text-left text-sm">
            <p>
              <span className="text-slate-500">School code:</span> <b>{done.school.code}</b>
            </p>
            <p>
              <span className="text-slate-500">Portal:</span> <b>{portalUrlFor(done.school.slug)}</b>
            </p>
            <p>
              <span className="text-slate-500">Sign in with:</span> <b>{done.loginHint.email}</b>
            </p>
          </div>
          <p className="mt-4 text-xs text-slate-500">
            We&apos;ve already set up your classes ({f.levels.map((l: string) => (l === 'KG' ? 'Kindergarten' : l === 'PRIMARY' ? 'Primary' : 'JHS')).join(', ')}) and the GES
            standards-based subjects for each, ready under Academics.
          </p>
          <Link
            href={`/login`}
            className="btn-primary mt-6"
            onClick={() => localStorage.setItem('schoolos.slug', done.school.slug)}
          >
            Go to sign in
          </Link>
        </div>
      </div>
    );

  return (
    <div className="min-h-screen bg-slate-50 py-10">
      <div className="mx-auto max-w-2xl px-4">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-slate-900">Register your school</h1>
          <p className="text-sm text-slate-500">Free trial, no card required. Step {step} of 3</p>
        </div>
        <div className="card p-6">
          {step === 1 && (
            <div className="space-y-4">
              <Field label="School name">
                <Input value={f.name} onChange={set('name')} placeholder="Bright Future Academy" />
              </Field>
              <Field
                label="Portal address"
                hint={`Your portal will be ${slugPreview || 'your-school'}.${process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'schoolos.app'}, you can add your own domain later`}
              >
                <Input value={f.slug} onChange={set('slug')} placeholder={slugPreview} />
              </Field>
              <Field label="Levels your school teaches" hint="Nimdee is built for basic schools. Pick every level you run">
                <div className="flex flex-wrap gap-2">
                  {[
                    ['KG', 'Kindergarten'],
                    ['PRIMARY', 'Primary (Basic 1–6)'],
                    ['JHS', 'JHS (Basic 7–9)'],
                  ].map(([code, label]) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() =>
                        setF({
                          ...f,
                          levels: f.levels.includes(code) ? f.levels.filter((l: string) => l !== code) : [...f.levels, code],
                        })
                      }
                      className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                        f.levels.includes(code) ? 'border-brand bg-brand-soft text-brand-dark' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Day or boarding?">
                <Select
                  value={f.residency}
                  onChange={set('residency')}
                  options={[
                    { value: 'DAY', label: 'Day school' },
                    { value: 'BOARDING', label: 'Boarding school' },
                    { value: 'DAY_AND_BOARDING', label: 'Both day and boarding students' },
                  ]}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Region">
                  <Select
                    value={f.region}
                    onChange={set('region')}
                    placeholder="Select region"
                    options={REGIONS.map((r) => ({ value: r, label: r }))}
                  />
                </Field>
                <Field label="District">
                  <Input value={f.district} onChange={set('district')} />
                </Field>
                <Field label="School phone">
                  <Input value={f.phone} onChange={set('phone')} placeholder="+233…" />
                </Field>
              </div>
              <Field label="Address">
                <Input value={f.address} onChange={set('address')} />
              </Field>
              <Field label="School email">
                <Input type="email" value={f.email} onChange={set('email')} />
              </Field>
              <div className="flex justify-end">
                <Button onClick={() => (f.name.length >= 3 ? setStep(2) : toast.error('Enter the school name'))}>
                  Continue
                </Button>
              </div>
            </div>
          )}
          {step === 2 && (
            <div className="space-y-4">
              <Alert kind="info">
                This account becomes the School Administrator with full access. You can add other staff later.
              </Alert>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="First name">
                  <Input value={f.adminFirstName} onChange={set('adminFirstName')} />
                </Field>
                <Field label="Last name">
                  <Input value={f.adminLastName} onChange={set('adminLastName')} />
                </Field>
              </div>
              <Field label="Work email">
                <Input type="email" value={f.adminEmail} onChange={set('adminEmail')} />
              </Field>
              <Field label="Password" hint="At least 8 characters">
                <Input type="password" value={f.adminPassword} onChange={set('adminPassword')} />
              </Field>
              <div className="flex justify-between">
                <Button variant="secondary" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button
                  onClick={() =>
                    f.adminFirstName && f.adminLastName && /\S+@\S+/.test(f.adminEmail) && f.adminPassword.length >= 8
                      ? setStep(3)
                      : toast.error('Complete the administrator details')
                  }
                >
                  Continue
                </Button>
              </div>
            </div>
          )}
          {step === 3 && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                {plans.map((p) => (
                  <button
                    key={p.code}
                    onClick={() => setF({ ...f, planCode: p.code })}
                    className={`rounded-xl border p-4 text-left ${f.planCode === p.code ? 'border-brand ring-2 ring-brand/30' : 'border-slate-200'}`}
                  >
                    <p className="font-semibold text-slate-900">{p.name}</p>
                    <p className="text-xs text-slate-500">{p.description}</p>
                    <p className="mt-2 text-lg font-semibold">
                      {money(p.priceYearly, p.currency)}
                      <span className="text-xs font-normal text-slate-500">/year</span>
                    </p>
                    <p className="text-xs text-slate-500">
                      Up to {p.studentLimit.toLocaleString()} students · {p.trialDays}-day trial
                    </p>
                  </button>
                ))}
              </div>
              <Checkbox
                label="I accept the terms of service and privacy policy"
                checked={f.agree}
                onChange={set('agree')}
              />
              <div className="flex justify-between">
                <Button variant="secondary" onClick={() => setStep(2)}>
                  Back
                </Button>
                <Button onClick={submit} loading={busy}>
                  Create school
                </Button>
              </div>
            </div>
          )}
        </div>
        <p className="mt-4 text-center text-xs text-slate-500">
          Already registered?{' '}
          <Link href="/login" className="text-brand">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
