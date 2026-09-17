'use client';
import { useState } from 'react';
import { classOptions } from '@/lib/academic';
import { Button, Checkbox, Field, Input, Select, Textarea } from '@/components/ui';

const GENDERS = [
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
  { value: 'OTHER', label: 'Other' },
];

export function StudentForm({
  initial,
  classes,
  onSubmit,
  submitLabel = 'Save',
  withGuardian,
}: {
  initial?: any;
  classes: any[];
  onSubmit: (data: any) => Promise<void>;
  submitLabel?: string;
  withGuardian?: boolean;
}) {
  const [f, setF] = useState<any>(() => {
    const base: any = {
      firstName: '',
      lastName: '',
      otherNames: '',
      gender: 'MALE',
      dateOfBirth: '',
      classId: '',
      house: '',
      admissionDate: '',
      isBoarding: false,
      previousSchool: '',
      address: '',
      medicalNotes: '',
      emergencyContactName: '',
      emergencyContactPhone: '',
      photoUrl: '',
    };
    for (const k of Object.keys(base)) if (initial?.[k] !== undefined && initial?.[k] !== null) base[k] = initial[k];
    base.dateOfBirth = initial?.dateOfBirth ? String(initial.dateOfBirth).slice(0, 10) : '';
    base.admissionDate = initial?.admissionDate ? String(initial.admissionDate).slice(0, 10) : '';
    return base;
  });
  const [g, setG] = useState<any>({ firstName: '', lastName: '', phone: '', email: '', relationship: 'PARENT' });
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: any) =>
    setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const setg = (k: string) => (e: any) => setG({ ...g, [k]: e.target.value });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body: any = {};
      Object.entries(f).forEach(([k, v]) => {
        if (v !== '' && v !== null && v !== undefined) body[k] = v;
      });
      if (!body.admissionDate) delete body.admissionDate;
      if (withGuardian && g.firstName) {
        body.guardian = { ...g };
        if (!body.guardian.email) delete body.guardian.email;
      }
      await onSubmit(body);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="First name">
          <Input required value={f.firstName} onChange={set('firstName')} />
        </Field>
        <Field label="Last name">
          <Input required value={f.lastName} onChange={set('lastName')} />
        </Field>
        <Field label="Other names">
          <Input value={f.otherNames ?? ''} onChange={set('otherNames')} />
        </Field>
        <Field label="Gender">
          <Select value={f.gender} onChange={set('gender')} options={GENDERS} />
        </Field>
        <Field label="Date of birth">
          <Input type="date" required value={f.dateOfBirth} onChange={set('dateOfBirth')} />
        </Field>
        <Field label="Class">
          <Select
            value={f.classId ?? ''}
            onChange={set('classId')}
            placeholder="Unassigned"
            options={classOptions(classes)}
          />
        </Field>
        <Field label="Admission date">
          <Input type="date" value={f.admissionDate} onChange={set('admissionDate')} />
        </Field>
        <Field label="House">
          <Input value={f.house ?? ''} onChange={set('house')} />
        </Field>
        <div className="flex items-end pb-2">
          <Checkbox label="Boarding student" checked={!!f.isBoarding} onChange={set('isBoarding')} />
        </div>
        <Field label="Previous school">
          <Input value={f.previousSchool ?? ''} onChange={set('previousSchool')} />
        </Field>
        <Field label="Photo URL">
          <Input value={f.photoUrl ?? ''} onChange={set('photoUrl')} placeholder="https://…" />
        </Field>
        <Field label="Home address">
          <Input value={f.address ?? ''} onChange={set('address')} />
        </Field>
        <Field label="Emergency contact name">
          <Input value={f.emergencyContactName ?? ''} onChange={set('emergencyContactName')} />
        </Field>
        <Field label="Emergency contact phone">
          <Input value={f.emergencyContactPhone ?? ''} onChange={set('emergencyContactPhone')} />
        </Field>
      </div>
      <Field label="Medical notes / allergies">
        <Textarea value={f.medicalNotes ?? ''} onChange={set('medicalNotes')} />
      </Field>
      {withGuardian && (
        <div className="rounded-lg border border-slate-200 p-4">
          <p className="mb-3 text-sm font-semibold text-slate-800">
            Primary guardian{' '}
            <span className="font-normal text-slate-500">(matched by phone if they already exist)</span>
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="First name">
              <Input value={g.firstName} onChange={setg('firstName')} />
            </Field>
            <Field label="Last name">
              <Input value={g.lastName} onChange={setg('lastName')} />
            </Field>
            <Field label="Phone">
              <Input value={g.phone} onChange={setg('phone')} placeholder="+233…" />
            </Field>
            <Field label="Email">
              <Input type="email" value={g.email} onChange={setg('email')} />
            </Field>
            <Field label="Relationship">
              <Select
                value={g.relationship}
                onChange={setg('relationship')}
                options={['PARENT', 'FATHER', 'MOTHER', 'GUARDIAN', 'SIBLING', 'OTHER'].map((r) => ({
                  value: r,
                  label: r.charAt(0) + r.slice(1).toLowerCase(),
                }))}
              />
            </Field>
          </div>
        </div>
      )}
      <div className="flex justify-end">
        <Button type="submit" loading={busy}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
