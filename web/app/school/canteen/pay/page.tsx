'use client';
import { useRouter } from 'next/navigation';
import { Suspense, useState } from 'react';
import { api, qs } from '@/lib/api';
import { useApi, useDebounce } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { fmtDate, money, title } from '@/lib/format';
import { Badge, Button, Card, Field, PageHeader, SearchBox, Select, useToast } from '@/components/ui';

const PERIODS = [
  { value: 'DAILY', label: 'One day' },
  { value: 'WEEKLY', label: 'This week (Mon–Fri)' },
  { value: 'MONTHLY', label: 'This month' },
  { value: 'TERMLY', label: 'Whole term' },
];

function RecordFeedingPayment() {
  const router = useRouter();
  const toast = useToast();
  const { me } = useAuth();
  const cur = me?.tenant?.currency ?? 'GHS';
  const [search, setSearch] = useState('');
  const q = useDebounce(search);
  const [studentId, setStudentId] = useState('');
  const [studentName, setStudentName] = useState('');
  const { data: results } = useApi<any>(q.length >= 2 ? `/students${qs({ search: q, pageSize: 8 })}` : null, [q]);
  const { data: studentPlan, loading: planLoading } = useApi<any>(
    studentId ? `/canteen/plans/student/${studentId}` : null,
    [studentId],
  );
  const [periodType, setPeriodType] = useState('WEEKLY');
  const [referenceDate, setReferenceDate] = useState(new Date().toISOString().slice(0, 10));
  const [preview, setPreview] = useState<any>(null);
  const [previewing, setPreviewing] = useState(false);
  const [charging, setCharging] = useState(false);

  const activePlan = studentPlan?.active?.plan;

  const runPreview = async () => {
    if (!activePlan) return;
    setPreviewing(true);
    setPreview(null);
    try {
      const p = await api.post('/canteen/plans/feeding-charges/preview', {
        studentId,
        planId: activePlan.id,
        periodType,
        referenceDate,
      });
      setPreview(p);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setPreviewing(false);
    }
  };

  const charge = async (bill: boolean) => {
    setCharging(true);
    try {
      await api.post('/canteen/plans/feeding-charges', {
        studentId,
        planId: activePlan.id,
        periodType,
        referenceDate,
        bill,
      });
      toast.success(`Feeding payment recorded — ${money(preview.amount, cur)} for ${preview.schoolDays} day(s)`);
      setPreview(null);
      setStudentId('');
      setStudentName('');
      setSearch('');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCharging(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        back={() => router.back()}
        title="Record a feeding payment"
        subtitle="Charge a student's feeding plan for a day, week, month or the whole term"
      />
      <Card title="1. Student" className="mb-4">
        {!studentId ? (
          <>
            <SearchBox value={search} onChange={setSearch} placeholder="Type a name or student ID…" />
            {results?.items?.length > 0 && (
              <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200">
                {results.items.map((s: any) => (
                  <li key={s.id}>
                    <button
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50"
                      onClick={() => {
                        setStudentId(s.id);
                        setStudentName(`${s.firstName} ${s.lastName}`);
                      }}
                    >
                      <span>
                        {s.firstName} {s.lastName}{' '}
                        <span className="text-slate-500">
                          · {s.studentId} · {s.class?.name ?? 'No class'}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <div className="flex items-center justify-between">
            <p className="font-medium text-slate-900">{studentName}</p>
            <button
              className="text-xs text-brand hover:underline"
              onClick={() => {
                setStudentId('');
                setStudentName('');
                setPreview(null);
              }}
            >
              Change
            </button>
          </div>
        )}
      </Card>
      {studentId && (
        <Card title="2. Plan" className="mb-4">
          {planLoading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : activePlan ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-900">{activePlan.name}</p>
                <p className="text-xs text-slate-500">
                  {money(activePlan.price, cur)} per school day · {title(activePlan.billingPeriod)}
                </p>
              </div>
              <Badge tone="emerald">Active</Badge>
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              This student isn&apos;t enrolled in a feeding plan yet. Enrol them from{' '}
              <a href="/school/canteen/plans" className="text-brand hover:underline">
                Meal plans
              </a>{' '}
              first.
            </p>
          )}
        </Card>
      )}
      {studentId && activePlan && (
        <Card title="3. Period" className="mb-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="How they're paying">
              <Select
                value={periodType}
                onChange={(e) => {
                  setPeriodType(e.target.value);
                  setPreview(null);
                }}
                options={PERIODS}
              />
            </Field>
            <Field label="Reference date" hint="Any date in the week/month/term you're charging for">
              <input
                type="date"
                className="input"
                value={referenceDate}
                onChange={(e) => {
                  setReferenceDate(e.target.value);
                  setPreview(null);
                }}
              />
            </Field>
          </div>
          <Button className="mt-3" variant="secondary" onClick={runPreview} loading={previewing}>
            Calculate
          </Button>
          {preview && (
            <div className="mt-4 rounded-lg border border-slate-200 p-4">
              <p className="text-sm text-slate-600">
                {fmtDate(preview.from)} to {fmtDate(preview.to)} &mdash; <b>{preview.schoolDays}</b> school day(s) at{' '}
                {money(preview.dailyRate, cur)}/day
              </p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{money(preview.amount, cur)}</p>
              {preview.alreadyCharged ? (
                <p className="mt-2 text-sm text-red-600">
                  Already charged: {fmtDate(preview.overlapsWith.from)} to {fmtDate(preview.overlapsWith.to)} overlaps
                  this period.
                </p>
              ) : preview.schoolDays <= 0 ? (
                <p className="mt-2 text-sm text-amber-600">No school days fall in this period.</p>
              ) : (
                <div className="mt-3 flex gap-2">
                  <Button onClick={() => charge(true)} loading={charging}>
                    Bill to fees
                  </Button>
                  <Button variant="secondary" onClick={() => charge(false)} loading={charging}>
                    Deduct from wallet
                  </Button>
                </div>
              )}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

export default function RecordFeedingPaymentPage() {
  return (
    <Suspense>
      <RecordFeedingPayment />
    </Suspense>
  );
}
