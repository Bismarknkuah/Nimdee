'use client';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { Badge, Button, Card, PageHeader, Spinner, useToast } from '@/components/ui';

/** Marks entry sheet for one assessment. */
export default function MarksEntry() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { can } = useAuth();
  const { data, loading, reload } = useApi(`/results/assessments/${id}/marks`);
  const [scores, setScores] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (data) {
      const m: any = {};
      data.students.forEach((s: any) => (m[s.id] = s.score === null ? '' : String(Number(s.score))));
      setScores(m);
    }
  }, [data]);
  if (loading || !data) return <Spinner />;
  const a = data.assessment;
  const max = Number(a.maxScore);
  const save = async () => {
    const marks = data.students.map((s: any) => ({
      studentId: s.id,
      score: scores[s.id] === '' || scores[s.id] === undefined ? null : Number(scores[s.id]),
    }));
    const bad = marks.find((m: any) => m.score !== null && (isNaN(m.score) || m.score < 0 || m.score > max));
    if (bad) return toast.error(`Scores must be between 0 and ${max}`);
    setBusy(true);
    try {
      const r = await api.put(`/results/assessments/${id}/marks`, { marks });
      toast.success(`${r.saved} mark(s) saved`);
      reload();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  const entered = Object.values(scores).filter((v) => v !== '').length;
  const avg = entered
    ? (
        Object.values(scores)
          .filter((v) => v !== '')
          .reduce((s, v) => s + Number(v), 0) / entered
      ).toFixed(1)
    : '—';
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        back={() => router.back()}
        title={a.name}
        subtitle={
          <span>
            {a.subject.name} · <Badge tone={a.type === 'EXAM' ? 'brand' : 'slate'}>{a.type}</Badge> · out of {max} ·
            weight {Number(a.weight)}
          </span>
        }
        actions={
          can('RESULT_ENTER') && (
            <Button onClick={save} loading={busy}>
              Save marks
            </Button>
          )
        }
      />
      <Card padded={false}>
        <div className="flex justify-between border-b border-slate-100 px-4 py-2 text-xs text-slate-600">
          <span>
            {entered} of {data.students.length} entered
          </span>
          <span>Average {avg}</span>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Student</th>
              <th className="w-40">Score / {max}</th>
              <th>%</th>
            </tr>
          </thead>
          <tbody>
            {data.students.map((s: any, i: number) => (
              <tr key={s.id}>
                <td className="text-slate-400">{i + 1}</td>
                <td>
                  {s.firstName} {s.lastName} <span className="text-xs text-slate-500">{s.studentId}</span>
                </td>
                <td>
                  <input
                    type="number"
                    min={0}
                    max={max}
                    step="0.5"
                    className="input"
                    value={scores[s.id] ?? ''}
                    disabled={!can('RESULT_ENTER')}
                    onChange={(e) => setScores({ ...scores, [s.id]: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const next = (e.currentTarget.closest('tr')?.nextElementSibling as HTMLElement)?.querySelector(
                          'input',
                        );
                        next?.focus();
                      }
                    }}
                  />
                </td>
                <td className="text-slate-500">
                  {scores[s.id] !== '' && scores[s.id] !== undefined
                    ? `${((Number(scores[s.id]) / max) * 100).toFixed(0)}%`
                    : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {can('RESULT_ENTER') && (
          <div className="flex justify-end border-t border-slate-100 p-3">
            <Button onClick={save} loading={busy}>
              Save marks
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
