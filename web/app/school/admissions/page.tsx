'use client';
import { useState } from 'react';
import { api, qs } from '@/lib/api';
import { useAcademic, classOptions } from '@/lib/academic';
import { useApi, useDebounce } from '@/lib/hooks';
import { fmtDate, title } from '@/lib/format';
import { portalUrlFor } from '@/lib/tenant';
import { useAuth } from '@/lib/auth';
import {
  Alert,
  Badge,
  Button,
  DataTable,
  Field,
  Input,
  Modal,
  PageHeader,
  SearchBox,
  Select,
  Textarea,
  useToast,
} from '@/components/ui';

const STATUSES = ['SUBMITTED', 'UNDER_REVIEW', 'INTERVIEW', 'ASSESSMENT', 'APPROVED', 'REJECTED', 'ADMITTED'];

export default function AdmissionsPage() {
  const toast = useToast();
  const { me, can } = useAuth();
  const { classes } = useAcademic();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [sel, setSel] = useState<any>(null);
  const [f, setF] = useState<any>({ status: 'UNDER_REVIEW', notes: '', interviewAt: '', classId: '' });
  const [busy, setBusy] = useState(false);
  const q = useDebounce(search);
  const { data, loading, reload } = useApi(`/admissions${qs({ search: q, status, page, pageSize: 25 })}`);
  const act = async (fn: () => Promise<any>, msg: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(msg);
      setSel(null);
      reload();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <PageHeader title="Admissions" subtitle={data ? `${data.total} applications` : undefined} />
      <Alert kind="info" className="mb-4">
        Applicants apply online at <b>{me?.tenant ? `${portalUrlFor(me.tenant.slug)}/apply` : '/apply'}</b>. Approved
        applications become students with one click.
      </Alert>
      <div className="mb-4 flex flex-wrap gap-2">
        {['', ...STATUSES].map((s) => (
          <button
            key={s}
            onClick={() => {
              setStatus(s);
              setPage(1);
            }}
            className={`rounded-full px-3 py-1 text-xs font-medium ${status === s ? 'bg-brand text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}
          >
            {s ? title(s) : 'All'}
            {data?.byStatus?.[s] ? ` (${data.byStatus[s]})` : ''}
          </button>
        ))}
        <div className="ml-auto w-64">
          <SearchBox value={search} onChange={setSearch} />
        </div>
      </div>
      <DataTable
        rows={data?.items}
        loading={loading}
        page={page}
        pageSize={25}
        total={data?.total}
        onPage={setPage}
        onRowClick={(r: any) => {
          setSel(r);
          setF({
            status: r.status === 'SUBMITTED' ? 'UNDER_REVIEW' : r.status,
            notes: r.notes ?? '',
            interviewAt: r.interviewAt ? String(r.interviewAt).slice(0, 16) : '',
            classId: r.appliedClassId ?? '',
          });
        }}
        columns={[
          { key: 'applicationNumber', header: 'Application' },
          { key: 'name', header: 'Applicant', render: (r: any) => `${r.firstName} ${r.lastName}` },
          { key: 'appliedLevel', header: 'Level' },
          { key: 'guardian', header: 'Guardian', render: (r: any) => `${r.guardianName} · ${r.guardianPhone}` },
          { key: 'createdAt', header: 'Applied', render: (r: any) => fmtDate(r.createdAt) },
          { key: 'status', header: 'Status', render: (r: any) => <Badge>{r.status}</Badge> },
        ]}
      />
      <Modal
        open={!!sel}
        onClose={() => setSel(null)}
        title={sel ? `${sel.firstName} ${sel.lastName} · ${sel.applicationNumber}` : ''}
        size="lg"
        footer={
          sel &&
          sel.status !== 'ADMITTED' &&
          sel.status !== 'REJECTED' &&
          can('ADMISSIONS_MANAGE') && (
            <>
              <Button
                variant="secondary"
                onClick={() =>
                  act(
                    () =>
                      api.patch(`/admissions/${sel.id}/status`, {
                        status: f.status,
                        notes: f.notes || undefined,
                        interviewAt: f.interviewAt ? new Date(f.interviewAt).toISOString() : undefined,
                      }),
                    'Status updated',
                  )
                }
                loading={busy}
              >
                Update status
              </Button>
              <Button
                onClick={() =>
                  f.classId
                    ? act(
                        () => api.post(`/admissions/${sel.id}/admit`, { classId: f.classId }),
                        'Applicant admitted as a student',
                      )
                    : toast.error('Choose a class to admit into')
                }
                loading={busy}
              >
                Admit into class
              </Button>
            </>
          )
        }
      >
        {sel && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3">
              <p>
                <span className="text-slate-500">Gender:</span> {title(sel.gender)}
              </p>
              <p>
                <span className="text-slate-500">Date of birth:</span> {fmtDate(sel.dateOfBirth)}
              </p>
              <p>
                <span className="text-slate-500">Previous school:</span> {sel.previousSchool ?? '—'}
              </p>
              <p>
                <span className="text-slate-500">Guardian email:</span> {sel.guardianEmail ?? '—'}
              </p>
              <p className="col-span-2">
                <span className="text-slate-500">Current status:</span> <Badge>{sel.status}</Badge>
                {sel.studentId && ' (student record created)'}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="New status">
                <Select
                  value={f.status}
                  onChange={(e) => setF({ ...f, status: e.target.value })}
                  options={['UNDER_REVIEW', 'INTERVIEW', 'ASSESSMENT', 'APPROVED', 'REJECTED'].map((s) => ({
                    value: s,
                    label: title(s),
                  }))}
                />
              </Field>
              <Field label="Interview / assessment date">
                <Input
                  type="datetime-local"
                  value={f.interviewAt}
                  onChange={(e) => setF({ ...f, interviewAt: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Notes">
              <Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
            </Field>
            <Field label="Admit into class">
              <Select
                value={f.classId}
                onChange={(e) => setF({ ...f, classId: e.target.value })}
                placeholder="Select class"
                options={classOptions(classes)}
              />
            </Field>
          </div>
        )}
      </Modal>
    </div>
  );
}
