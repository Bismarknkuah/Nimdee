'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Plus } from 'lucide-react';
import { api, qs } from '@/lib/api';
import { useApi, useDebounce } from '@/lib/hooks';
import { ago, num } from '@/lib/format';
import { Badge, Button, DataTable, Field, Input, Modal, PageHeader, Select, SearchBox, useToast } from '@/components/ui';

function NewSchoolModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const { data: plans } = useApi<any[]>('/platform/plans');
  const [f, setF] = useState<any>({
    name: '',
    adminFirstName: '',
    adminLastName: '',
    adminEmail: '',
    planCode: '',
  });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  const submit = async () => {
    setBusy(true);
    try {
      const body = { ...f };
      Object.keys(body).forEach((k) => body[k] === '' && delete body[k]);
      const r = await api.post('/platform/schools', body);
      setResult(r);
      onDone();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  if (result) {
    return (
      <Modal open onClose={onClose} title="School created" footer={<Button onClick={onClose}>Done</Button>}>
        <p className="mb-3 text-sm text-slate-600">
          <b>{result.school.name}</b> is active and ready to sign in.
        </p>
        <div className="space-y-1 rounded-md bg-slate-50 p-3 text-sm">
          <p>
            Portal: <span className="font-mono">{result.portalUrl}</span>
          </p>
          <p>
            School code for login: <span className="font-mono">{result.loginHint.school}</span>
          </p>
          <p>
            Admin email: <span className="font-mono">{result.loginHint.email}</span>
          </p>
          {result.temporaryPassword && (
            <p>
              Temporary password: <span className="font-mono">{result.temporaryPassword}</span>
            </p>
          )}
        </div>
      </Modal>
    );
  }
  return (
    <Modal
      open
      onClose={onClose}
      title="New school"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy} disabled={!f.name || !f.adminFirstName || !f.adminEmail}>
            Create school
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="School name" className="sm:col-span-2">
          <Input value={f.name} onChange={set('name')} />
        </Field>
        <Field label="Admin first name">
          <Input value={f.adminFirstName} onChange={set('adminFirstName')} />
        </Field>
        <Field label="Admin last name">
          <Input value={f.adminLastName} onChange={set('adminLastName')} />
        </Field>
        <Field label="Admin email" className="sm:col-span-2">
          <Input type="email" value={f.adminEmail} onChange={set('adminEmail')} />
        </Field>
        <Field label="Temporary password" hint="Leave blank to auto-generate one, shown once on save">
          <Input value={f.adminPassword ?? ''} onChange={set('adminPassword')} placeholder="Auto-generated" />
        </Field>
        <Field label="Plan">
          <Select
            value={f.planCode}
            onChange={set('planCode')}
            placeholder="Default (Starter)"
            options={(plans ?? []).map((p: any) => ({ value: p.code, label: p.name }))}
          />
        </Field>
      </div>
    </Modal>
  );
}

function Schools() {
  const params = useSearchParams();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(params.get('status') ?? '');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const q = useDebounce(search);
  const { data, loading, reload } = useApi(`/platform/schools${qs({ search: q, status, page, pageSize: 25 })}`, [
    q,
    status,
    page,
  ]);
  return (
    <div>
      <PageHeader
        title="Schools"
        subtitle={data ? `${data.total} schools` : undefined}
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus size={16} /> New school
          </Button>
        }
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <SearchBox
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="Name, code, slug or email"
          />
        </div>
        <Select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          placeholder="All statuses"
          options={['PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED'].map((s) => ({ value: s, label: s }))}
        />
      </div>
      <DataTable
        rows={data?.items}
        loading={loading}
        page={page}
        pageSize={25}
        total={data?.total}
        onPage={setPage}
        onRowClick={(r: any) => router.push(`/platform/schools/${r.id}`)}
        columns={[
          {
            key: 'name',
            header: 'School',
            render: (s: any) => (
              <div>
                <p className="font-medium text-slate-900">{s.name}</p>
                <p className="text-xs text-slate-500">
                  {s.code} · {s.slug}
                </p>
              </div>
            ),
          },
          { key: 'region', header: 'Region', render: (s: any) => s.region ?? '—' },
          {
            key: 'plan',
            header: 'Plan',
            render: (s: any) => (
              <span>
                {s.subscription?.plan?.name ?? '—'} <Badge>{s.subscription?.status ?? 'NONE'}</Badge>
              </span>
            ),
          },
          {
            key: 'studentCount',
            header: 'Students',
            align: 'right',
            render: (s: any) => `${num(s.studentCount)} / ${num(s.subscription?.plan?.studentLimit ?? 0)}`,
          },
          { key: 'status', header: 'Status', render: (s: any) => <Badge>{s.status}</Badge> },
          { key: 'createdAt', header: 'Registered', render: (s: any) => ago(s.createdAt) },
        ]}
      />
      {creating && (
        <NewSchoolModal
          onClose={() => setCreating(false)}
          onDone={() => {
            reload();
          }}
        />
      )}
    </div>
  );
}
export default function SchoolsPage() {
  return (
    <Suspense>
      <Schools />
    </Suspense>
  );
}
