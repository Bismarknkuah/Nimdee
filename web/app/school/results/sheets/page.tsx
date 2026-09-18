'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { api, downloadBlob, openBlob, qs } from '@/lib/api';
import { useAcademic, classOptions } from '@/lib/academic';
import { useApi } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { title } from '@/lib/format';
import { Alert, Badge, Button, DataTable, Field, Modal, PageHeader, Select, Textarea, useToast } from '@/components/ui';

function Sheets() {
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const { can } = useAuth();
  const { term, terms, classes } = useAcademic();
  const [termId, setTermId] = useState(params.get('termId') ?? '');
  const [classId, setClassId] = useState(params.get('classId') ?? '');
  useEffect(() => {
    if (term && !termId) setTermId(term.id);
  }, [term, termId]);
  const {
    data: sheets,
    loading,
    reload,
  } = useApi(termId ? `/results/sheets${qs({ termId, classId })}` : null, [termId, classId]);
  const { data: workflow } = useApi('/results/workflow');
  const { data: overview, reload: reloadOverview } = useApi(termId ? `/results/overview${qs({ termId })}` : null, [
    termId,
  ]);
  const [reject, setReject] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const act = async (action: string, body: any = {}) => {
    setBusy(true);
    try {
      const r = await api.post(`/results/${action}`, { termId, classId, ...body });
      toast.success(`${title(action)}: ${r.count} sheet(s)`);
      reload();
      reloadOverview();
      setReject(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  const counts = (sheets ?? []).reduce((a: any, s: any) => ({ ...a, [s.status]: (a[s.status] ?? 0) + 1 }), {});
  const chain: string[] = workflow?.chain ?? [];
  return (
    <div>
      <PageHeader
        title="Result sheets"
        subtitle={workflow ? `Approval workflow: ${chain.map(title).join(' → ')}` : undefined}
        actions={
          <>
            {can('EXPORT_DATA') && termId && (
              <Button
                variant="secondary"
                onClick={() => downloadBlob(`/exports/results.csv${qs({ termId, classId })}`, 'results.csv')}
              >
                <Download size={16} /> Export
              </Button>
            )}
            {classId && termId && (
              <Button
                variant="secondary"
                onClick={() => openBlob(`/documents/results/report-cards.pdf?termId=${termId}&classId=${classId}`)}
              >
                All report cards (PDF)
              </Button>
            )}
            <Link href="/school/results" className="btn-secondary">
              Assessments
            </Link>
          </>
        }
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Field label="Term">
          <Select
            value={termId}
            onChange={(e) => setTermId(e.target.value)}
            options={terms.map((t: any) => ({ value: t.id, label: t.name }))}
          />
        </Field>
        <Field label="Class">
          <Select
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            placeholder="All classes"
            options={classOptions(classes)}
          />
        </Field>
      </div>
      {!classId && overview && (
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {overview.map((c: any) => (
            <button
              key={c.classId}
              onClick={() => setClassId(c.classId)}
              className="card p-3 text-left hover:border-brand"
            >
              <p className="font-medium">{c.name}</p>
              <p className="text-xs text-slate-500">
                {c.sheets}/{c.enrolled} sheets{c.averageOfAverages !== null ? ` · avg ${c.averageOfAverages}%` : ''}
              </p>
              <div className="mt-1 flex flex-wrap gap-1">
                {Object.entries(c.byStatus).map(([k, v]) => (
                  <Badge key={k}>{`${title(k)} ${v}`}</Badge>
                ))}
              </div>
            </button>
          ))}
        </div>
      )}
      {classId && sheets && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {Object.entries(counts).map(([k, v]) => (
            <Badge key={k}>{`${title(k)}: ${v}`}</Badge>
          ))}
          <div className="ml-auto flex flex-wrap gap-2">
            {can('RESULT_ENTER') && counts.DRAFT > 0 && (
              <Button variant="secondary" onClick={() => act('submit')} loading={busy}>
                Submit for review
              </Button>
            )}
            {can('RESULT_REVIEW') && chain.includes('REVIEWED') && counts.SUBMITTED > 0 && (
              <Button variant="secondary" onClick={() => act('review')} loading={busy}>
                Mark reviewed
              </Button>
            )}
            {can('RESULT_APPROVE') &&
              chain.includes('APPROVED') &&
              counts[chain[chain.indexOf('APPROVED') - 1]] > 0 && (
                <Button variant="secondary" onClick={() => act('approve')} loading={busy}>
                  Approve
                </Button>
              )}
            {can('RESULT_PUBLISH') && counts[chain[chain.indexOf('PUBLISHED') - 1]] > 0 && (
              <Button
                onClick={() => confirm('Publish results to parents and students?') && act('publish')}
                loading={busy}
              >
                Publish
              </Button>
            )}
            {can('RESULT_REVIEW') && (counts.SUBMITTED || counts.REVIEWED || counts.APPROVED) && (
              <Button variant="danger" onClick={() => setReject(true)}>
                Send back
              </Button>
            )}
          </div>
        </div>
      )}
      {classId && sheets && !sheets.length && (
        <Alert kind="info" className="mb-4">
          No result sheets for this class yet. Enter marks and click “Compute results” on the assessments page.
        </Alert>
      )}
      {classId && (
        <DataTable
          rows={sheets}
          loading={loading}
          onRowClick={(r: any) => router.push(`/school/results/sheets/${r.id}`)}
          columns={[
            { key: 'position', header: 'Pos.', align: 'center', render: (s: any) => s.position ?? '—' },
            { key: 'student', header: 'Student', render: (s: any) => `${s.student.firstName} ${s.student.lastName}` },
            {
              key: 'average',
              header: 'Average',
              align: 'right',
              render: (s: any) => `${Number(s.average).toFixed(1)}%`,
            },
            { key: 'overallGrade', header: 'Grade', align: 'center', render: (s: any) => s.overallGrade ?? '—' },
            { key: 'subjectCount', header: 'Subjects graded', align: 'right' },
            {
              key: 'attendance',
              header: 'Attendance',
              render: (s: any) => `${s.attendancePresent}/${s.attendanceTotal}`,
            },
            { key: 'promotionStatus', header: 'Promotion', render: (s: any) => s.promotionStatus ?? '—' },
            { key: 'status', header: 'Status', render: (s: any) => <Badge>{s.status}</Badge> },
          ]}
        />
      )}
      <Modal
        open={reject}
        onClose={() => setReject(false)}
        title="Send results back to teacher"
        footer={
          <>
            <Button variant="secondary" onClick={() => setReject(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => act('reject', { reason })} loading={busy} disabled={!reason}>
              Send back
            </Button>
          </>
        }
      >
        <Field label="Reason">
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </Modal>
    </div>
  );
}
export default function SheetsPage() {
  return (
    <Suspense>
      <Sheets />
    </Suspense>
  );
}
