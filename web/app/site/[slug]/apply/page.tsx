'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Button, Field, Input, Select, useToast } from '@/components/ui';

export default function ApplyPage() {
  const { slug } = useParams<{ slug: string }>();
  const toast = useToast();
  const [site, setSite] = useState<any>(null);
  const [classes, setClasses] = useState<any[]>([]);
  const [done, setDone] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState<any>({
    firstName: '',
    lastName: '',
    gender: 'MALE',
    dateOfBirth: '',
    appliedLevel: '',
    appliedClassId: '',
    guardianName: '',
    guardianPhone: '',
    guardianEmail: '',
    previousSchool: '',
  });
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  useEffect(() => {
    api.public
      .get(`/public/site/${slug}`)
      .then(setSite)
      .catch(() => undefined);
    api.public
      .get(`/public/schools/${slug}/classes`)
      .then(setClasses)
      .catch(() => undefined);
  }, [slug]);
  const levels = Array.from(new Set(classes.map((c) => c.level)));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = { ...f };
      if (!body.appliedClassId) delete body.appliedClassId;
      if (!body.guardianEmail) delete body.guardianEmail;
      if (!body.previousSchool) delete body.previousSchool;
      setDone(await api.public.post(`/public/admissions/${slug}/apply`, body));
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };
  const brand = site?.school?.primaryColor || '#1d4ed8';
  return (
    <div
      className="min-h-screen bg-slate-50 py-10"
      style={{ ['--brand' as any]: brand, ['--brand-dark' as any]: brand }}
    >
      <div className="mx-auto max-w-2xl px-4">
        <Link href={`/site/${slug}`} className="text-sm text-slate-500 hover:underline">
          ← {site?.school?.name ?? 'Back'}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">
          {site?.website?.pages?.admissions?.title ?? 'Admissions'}
        </h1>
        <p className="text-sm text-slate-600">{site?.website?.pages?.admissions?.body ?? 'Apply online below.'}</p>
        {done ? (
          <div className="card mt-6 p-8 text-center">
            <h2 className="text-xl font-semibold text-slate-900">Application received</h2>
            <p className="mt-2 text-slate-600">{done.message}</p>
            <p className="mt-4 text-sm">
              Your application number is <b>{done.applicationNumber}</b>. Keep it for your records.
            </p>
          </div>
        ) : site && site.website?.pages?.admissions?.open === false ? (
          <div className="card mt-6 p-8 text-center">
            <h2 className="text-xl font-semibold text-slate-900">Not accepting applications right now</h2>
            <p className="mt-2 text-slate-600">
              {site.school?.name ?? 'This school'} isn&apos;t taking new online applications at the moment. Please
              check back later or contact the school directly.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="card mt-6 space-y-4 p-6">
            <h3 className="font-semibold text-slate-800">Applicant</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="First name">
                <Input required value={f.firstName} onChange={set('firstName')} />
              </Field>
              <Field label="Last name">
                <Input required value={f.lastName} onChange={set('lastName')} />
              </Field>
              <Field label="Gender">
                <Select
                  value={f.gender}
                  onChange={set('gender')}
                  options={[
                    { value: 'MALE', label: 'Male' },
                    { value: 'FEMALE', label: 'Female' },
                    { value: 'OTHER', label: 'Other' },
                  ]}
                />
              </Field>
              <Field label="Date of birth">
                <Input type="date" required value={f.dateOfBirth} onChange={set('dateOfBirth')} />
              </Field>
              <Field label="Applying for (level)">
                <Select
                  required
                  value={f.appliedLevel}
                  onChange={set('appliedLevel')}
                  placeholder="Select level"
                  options={(levels.length ? levels : ['KG', 'PRIMARY', 'JHS']).map((l) => ({ value: l, label: l }))}
                />
              </Field>
              <Field label="Preferred class (optional)">
                <Select
                  value={f.appliedClassId}
                  onChange={set('appliedClassId')}
                  placeholder="Any"
                  options={classes
                    .filter((c) => !f.appliedLevel || c.level === f.appliedLevel)
                    .map((c) => ({ value: c.id, label: c.name }))}
                />
              </Field>
            </div>
            <Field label="Previous school (optional)">
              <Input value={f.previousSchool} onChange={set('previousSchool')} />
            </Field>
            <h3 className="pt-2 font-semibold text-slate-800">Parent / guardian</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name">
                <Input required value={f.guardianName} onChange={set('guardianName')} />
              </Field>
              <Field label="Phone">
                <Input required value={f.guardianPhone} onChange={set('guardianPhone')} placeholder="+233…" />
              </Field>
            </div>
            <Field label="Email (optional)">
              <Input type="email" value={f.guardianEmail} onChange={set('guardianEmail')} />
            </Field>
            <Button type="submit" className="w-full" loading={busy}>
              Submit application
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
