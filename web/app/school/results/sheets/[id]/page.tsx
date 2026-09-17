'use client';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { FileDown } from 'lucide-react';
import { api, openBlob } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { title } from '@/lib/format';
import { Badge, Button, Card, Field, Input, PageHeader, Spinner, Textarea, useToast } from '@/components/ui';

export default function SheetDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { can } = useAuth();
  const { data: s, loading, reload } = useApi(`/results/sheets/${id}`);
  const [c, setC] = useState<any>({});
  useEffect(() => {
    if (s)
      setC({
        classTeacherComment: s.classTeacherComment ?? '',
        headComment: s.headComment ?? '',
        conduct: s.conduct ?? '',
        promotionStatus: s.promotionStatus ?? '',
      });
  }, [s]);
  if (loading || !s) return <Spinner />;
  const save = async () => {
    try {
      await api.patch(`/results/sheets/${id}/comments`, c);
      toast.success('Comments saved');
      reload();
    } catch (e: any) {
      toast.error(e.message);
    }
  };
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        back={() => router.back()}
        title={
          <>
            {s.student.firstName} {s.student.lastName} <Badge>{s.status}</Badge>
          </>
        }
        subtitle={`${s.student.class?.name} · ${s.term.name} ${s.term.academicYear.name} · Position ${s.position ?? '—'} of ${s.classSize}`}
        actions={
          <Button variant="secondary" onClick={() => openBlob(`/results/sheets/${id}/report-card.pdf`)}>
            <FileDown size={16} /> Report card PDF
          </Button>
        }
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <Card>
          <p className="text-xs text-slate-500">Average</p>
          <p className="text-2xl font-semibold">{Number(s.average).toFixed(1)}%</p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500">Overall grade</p>
          <p className="text-2xl font-semibold">{s.overallGrade ?? '—'}</p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500">Attendance</p>
          <p className="text-2xl font-semibold">
            {s.attendancePresent}/{s.attendanceTotal}
          </p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500">Promotion</p>
          <p className="text-lg font-semibold">{s.promotionStatus ?? '—'}</p>
        </Card>
      </div>
      {s.rejectionReason && s.status === 'DRAFT' && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          Sent back: {s.rejectionReason}
        </div>
      )}
      <Card padded={false} className="mb-4">
        <table className="table">
          <thead>
            <tr>
              <th>Subject</th>
              <th className="text-right">Class score</th>
              <th className="text-right">Exam</th>
              <th className="text-right">Total</th>
              <th className="text-center">Grade</th>
              <th className="text-center">Position</th>
              <th>Remark</th>
            </tr>
          </thead>
          <tbody>
            {s.subjects.map((x: any) => (
              <tr key={x.subjectId} className={!x.hasMarks ? 'text-slate-400' : ''}>
                <td>{x.name}</td>
                <td className="text-right">{x.ca.toFixed(1)}</td>
                <td className="text-right">{x.exam.toFixed(1)}</td>
                <td className="text-right font-medium">{x.total.toFixed(1)}</td>
                <td className="text-center">{x.grade ?? '—'}</td>
                <td className="text-center">{x.position ?? '—'}</td>
                <td>{x.remark}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Card title="Comments">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Conduct">
            <Input value={c.conduct} onChange={(e) => setC({ ...c, conduct: e.target.value })} />
          </Field>
          <Field label="Promotion status">
            <Input value={c.promotionStatus} onChange={(e) => setC({ ...c, promotionStatus: e.target.value })} />
          </Field>
          <Field label="Class teacher's remark">
            <Textarea
              value={c.classTeacherComment}
              onChange={(e) => setC({ ...c, classTeacherComment: e.target.value })}
            />
          </Field>
          <Field label="Head teacher's remark">
            <Textarea value={c.headComment} onChange={(e) => setC({ ...c, headComment: e.target.value })} />
          </Field>
        </div>
        {can('RESULT_ENTER') && (
          <div className="mt-3 flex justify-end">
            <Button onClick={save}>Save comments</Button>
          </div>
        )}
        <p className="mt-3 text-xs text-slate-500">Workflow: {s.workflow.map(title).join(' → ')}</p>
      </Card>
    </div>
  );
}
