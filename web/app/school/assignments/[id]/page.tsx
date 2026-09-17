'use client';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { fmtDateTime } from '@/lib/format';
import { Avatar, Badge, Button, Card, KeyStat, PageHeader, Spinner, useToast } from '@/components/ui';

/** Grading sheet for one assignment. */
export default function AssignmentDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { can } = useAuth();
  const { data: a, loading, reload } = useApi(`/assignments/${id}`);
  const [rows, setRows] = useState<Record<string, { status: string; score: string; feedback: string }>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (a) {
      const m: any = {};
      a.submissions.forEach(
        (s: any) =>
          (m[s.studentId] = {
            status: s.status,
            score: s.score === null ? '' : String(Number(s.score)),
            feedback: s.feedback ?? '',
          }),
      );
      setRows(m);
    }
  }, [a]);
  if (loading || !a) return <Spinner />;
  const max = a.maxScore ? Number(a.maxScore) : null;
  const save = async () => {
    setBusy(true);
    try {
      const items = a.submissions.map((s: any) => ({
        studentId: s.studentId,
        status: rows[s.studentId]?.status,
        score: rows[s.studentId]?.score === '' ? null : Number(rows[s.studentId]?.score),
        feedback: rows[s.studentId]?.feedback || undefined,
      }));
      await api.put(`/assignments/${id}/grades`, { items });
      toast.success('Grades saved');
      reload();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  const setStatus = async (status: string) => {
    try {
      await api.patch(`/assignments/${id}`, { status });
      toast.success(`Assignment ${status.toLowerCase()}`);
      reload();
    } catch (e: any) {
      toast.error(e.message);
    }
  };
  const bs = a.byStatus ?? {};
  return (
    <div>
      <PageHeader
        back={() => router.back()}
        title={
          <>
            {a.title} <Badge>{a.status}</Badge>
          </>
        }
        subtitle={`${a.subject.name} · ${a.class.name} · due ${fmtDateTime(a.dueAt)}${max ? ` · out of ${max}` : ''}`}
        actions={
          can('ASSIGNMENTS_MANAGE') && (
            <>
              {a.status === 'DRAFT' && (
                <Button variant="secondary" onClick={() => setStatus('PUBLISHED')}>
                  Publish
                </Button>
              )}
              {a.status === 'PUBLISHED' && (
                <Button variant="secondary" onClick={() => setStatus('CLOSED')}>
                  Close
                </Button>
              )}
              <Button onClick={save} loading={busy}>
                Save grades
              </Button>
            </>
          )
        }
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-5">
        <KeyStat label="Students" value={a.total} />
        <KeyStat label="Submitted" value={(bs.SUBMITTED ?? 0) + (bs.LATE ?? 0)} tone="brand" />
        <KeyStat label="Graded" value={bs.GRADED ?? 0} tone="emerald" />
        <KeyStat label="Pending" value={bs.PENDING ?? 0} tone="amber" />
        <KeyStat label="Missing" value={bs.MISSING ?? 0} tone="red" />
      </div>
      <Card title="Instructions" className="mb-4">
        <p className="whitespace-pre-line text-sm text-slate-700">{a.instructions}</p>
        {Array.isArray(a.attachments) && a.attachments.length > 0 && (
          <ul className="mt-2 text-sm">
            {a.attachments.map((x: any, i: number) => (
              <li key={i}>
                <a href={x.url} target="_blank" className="text-brand hover:underline">
                  {x.name}
                </a>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card padded={false}>
        <table className="table">
          <thead>
            <tr>
              <th>Student</th>
              <th className="w-36">Status</th>
              <th className="w-28">Score{max ? ` / ${max}` : ''}</th>
              <th>Feedback</th>
              <th>Submitted</th>
            </tr>
          </thead>
          <tbody>
            {a.submissions.map((s: any) => {
              const r = rows[s.studentId] ?? { status: s.status, score: '', feedback: '' };
              return (
                <tr key={s.id}>
                  <td>
                    <div className="flex items-center gap-2">
                      <Avatar
                        name={`${s.student.firstName} ${s.student.lastName}`}
                        src={s.student.photoUrl}
                        size="sm"
                      />
                      <div>
                        <p className="font-medium">
                          {s.student.firstName} {s.student.lastName}
                        </p>
                        <p className="text-xs text-slate-500">{s.student.studentId}</p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <select
                      className="input"
                      value={r.status}
                      disabled={!can('ASSIGNMENTS_MANAGE')}
                      onChange={(e) => setRows({ ...rows, [s.studentId]: { ...r, status: e.target.value } })}
                    >
                      {['PENDING', 'SUBMITTED', 'LATE', 'GRADED', 'MISSING'].map((x) => (
                        <option key={x} value={x}>
                          {x.charAt(0) + x.slice(1).toLowerCase()}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      type="number"
                      className="input"
                      min={0}
                      max={max ?? undefined}
                      step="0.5"
                      value={r.score}
                      disabled={!can('ASSIGNMENTS_MANAGE')}
                      onChange={(e) =>
                        setRows({
                          ...rows,
                          [s.studentId]: {
                            ...r,
                            score: e.target.value,
                            status: e.target.value !== '' ? 'GRADED' : r.status,
                          },
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      className="input"
                      value={r.feedback}
                      placeholder="Feedback to the student"
                      disabled={!can('ASSIGNMENTS_MANAGE')}
                      onChange={(e) => setRows({ ...rows, [s.studentId]: { ...r, feedback: e.target.value } })}
                    />
                  </td>
                  <td className="text-xs text-slate-500">{s.submittedAt ? fmtDateTime(s.submittedAt) : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {can('ASSIGNMENTS_MANAGE') && (
          <div className="flex justify-end border-t border-slate-100 p-3">
            <Button onClick={save} loading={busy}>
              Save grades
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
