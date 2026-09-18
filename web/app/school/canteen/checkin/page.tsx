'use client';
import { useState } from 'react';
import { CheckCircle2, Utensils } from 'lucide-react';
import { api } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { Badge, Card, PageHeader, Select, Spinner, useToast } from '@/components/ui';
import { title } from '@/lib/format';

/**
 * The daily meal-plan roster: no menu, no prices, just "did this student eat today". Money already
 * changed hands when the student was enrolled in the plan (an invoice or a wallet debit), so this
 * screen is closer to attendance than to a sale.
 */
export default function CanteenCheckin() {
  const toast = useToast();
  const { data: classes } = useApi<any[]>('/academic/classes');
  const [classId, setClassId] = useState('');
  const { data, loading, reload } = useApi<any[]>(`/canteen/checkin/roster${classId ? `?classId=${classId}` : ''}`);
  const [busyId, setBusyId] = useState<string | null>(null);

  const checkIn = async (studentId: string) => {
    setBusyId(studentId);
    try {
      const r = await api.post(`/canteen/checkin/${studentId}`, {});
      toast.success(r.remainingToday > 0 ? `Checked in, ${r.remainingToday} meal(s) left today` : 'Checked in');
      reload();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const eaten = (data ?? []).filter((r) => r.checkedIn).length;

  return (
    <div>
      <PageHeader
        title="Meal check-in"
        subtitle="Tap a student once they've eaten. No items or prices, just today's roster."
        actions={
          <Select
            placeholder="All classes"
            options={(classes ?? []).map((c: any) => ({ value: c.id, label: `${c.name} (${title(c.level)})` }))}
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            className="w-56"
          />
        }
      />
      {loading ? (
        <Spinner />
      ) : !data?.length ? (
        <Card>
          <p className="py-10 text-center text-sm text-slate-500">
            No students are enrolled in a meal plan{classId ? ' for this class' : ''} yet. Set one up under{' '}
            <span className="font-medium">Canteen &gt; Meal plans</span>.
          </p>
        </Card>
      ) : (
        <>
          <p className="mb-3 text-sm text-slate-500">
            {eaten} of {data.length} checked in today
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {data.map((r) => (
              <button
                key={r.studentId}
                disabled={r.checkedIn || busyId === r.studentId}
                onClick={() => checkIn(r.studentId)}
                className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${
                  r.checkedIn
                    ? 'border-emerald-200 bg-emerald-50'
                    : 'border-slate-200 bg-white hover:border-brand hover:shadow-sm'
                }`}
              >
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                    r.checkedIn ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {r.checkedIn ? <CheckCircle2 size={20} /> : <Utensils size={18} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-800">
                    {r.student.firstName} {r.student.lastName}
                  </span>
                  <span className="block truncate text-xs text-slate-500">
                    {r.student.class?.name} &middot; {r.planName}
                  </span>
                </span>
                {r.mealsPerDay > 1 && (
                  <Badge tone={r.checkedIn ? 'emerald' : 'slate'}>
                    {r.mealsUsedToday}/{r.mealsPerDay}
                  </Badge>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
