'use client';
import { useState } from 'react';
import { CheckCircle2, Circle } from 'lucide-react';
import { api } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { todayIso } from '@/lib/format';
import { Avatar, Badge, Button, Card, PageHeader, Select, Spinner, useToast } from '@/components/ui';

const STATUSES: { value: string; label: string; tone: string }[] = [
  { value: 'PRESENT', label: 'P', tone: 'bg-emerald-600' },
  { value: 'ABSENT', label: 'A', tone: 'bg-red-600' },
  { value: 'LATE', label: 'L', tone: 'bg-amber-500' },
  { value: 'EXCUSED', label: 'E', tone: 'bg-sky-600' },
  { value: 'SICK', label: 'S', tone: 'bg-violet-600' },
];

function LessonRoster({ lessonId, onDone }: { lessonId: string; onDone: () => void }) {
  const toast = useToast();
  const today = todayIso();
  const { data, loading } = useApi<any>(`/attendance/lessons/${lessonId}/roster?date=${today}`);
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  if (loading || !data) return <Spinner />;
  const statusFor = (studentId: string) => marks[studentId] ?? data.students.find((s: any) => s.id === studentId)?.status ?? 'PRESENT';
  const markAll = (status: string) => {
    const next: Record<string, string> = {};
    for (const s of data.students) next[s.id] = status;
    setMarks(next);
  };
  const submit = async () => {
    setBusy(true);
    try {
      const records = data.students.map((s: any) => ({ studentId: s.id, status: statusFor(s.id) }));
      const r = await api.post('/attendance/lessons/mark', { timetableSlotId: lessonId, date: today, records });
      toast.success(`Attendance saved for ${r.applied} student(s)`);
      onDone();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card
      title={
        <span>
          {data.slot.subject.name} — {data.slot.class.name}
          <span className="ml-2 text-xs font-normal text-slate-400">
            {data.slot.period.name} · {data.slot.period.startTime}–{data.slot.period.endTime}
          </span>
        </span>
      }
      actions={
        <div className="flex gap-1.5">
          <Button variant="secondary" onClick={() => markAll('PRESENT')}>
            Mark all present
          </Button>
          <Button onClick={submit} loading={busy}>
            Save attendance
          </Button>
        </div>
      }
    >
      <div className="divide-y divide-slate-100">
        {data.students.map((s: any) => (
          <div key={s.id} className="flex items-center justify-between py-2.5">
            <div className="flex items-center gap-2.5">
              <Avatar name={`${s.firstName} ${s.lastName}`} src={s.photoUrl} size="sm" />
              <div>
                <p className="text-sm font-medium text-slate-800">
                  {s.firstName} {s.lastName}
                </p>
                <p className="text-xs text-slate-400">{s.studentId}</p>
              </div>
            </div>
            <div className="flex gap-1">
              {STATUSES.map((st) => (
                <button
                  key={st.value}
                  onClick={() => setMarks({ ...marks, [s.id]: st.value })}
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white ${
                    statusFor(s.id) === st.value ? st.tone : 'bg-slate-200 text-slate-400'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default function MyLessonsTodayPage() {
  const { data: lessons, loading, reload } = useApi<any[]>('/attendance/my-lessons-today');
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div>
      <PageHeader
        title="My lessons today"
        subtitle="Take attendance for each lesson as it starts — separate from the daily class register"
      />
      {loading ? (
        <Spinner />
      ) : !lessons?.length ? (
        <Card>
          <p className="py-8 text-center text-sm text-slate-500">No lessons scheduled for you today.</p>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {lessons.map((l) => (
            <button
              key={l.id}
              onClick={() => setOpen(l.id)}
              className={`card flex items-center justify-between p-4 text-left hover:border-brand ${
                open === l.id ? 'border-brand ring-1 ring-brand' : ''
              }`}
            >
              <div>
                <p className="font-medium text-slate-900">
                  {l.subject.name} — {l.class.name}
                </p>
                <p className="text-xs text-slate-500">
                  {l.period.name} · {l.period.startTime}–{l.period.endTime}
                </p>
              </div>
              {l.marked ? (
                <Badge tone="emerald">
                  <CheckCircle2 size={12} className="mr-1 inline" /> Done
                </Badge>
              ) : (
                <Circle size={16} className="text-slate-300" />
              )}
            </button>
          ))}
        </div>
      )}
      {open && (
        <div className="mt-4">
          <LessonRoster
            lessonId={open}
            onDone={() => {
              reload();
              setOpen(null);
            }}
          />
        </div>
      )}
    </div>
  );
}
