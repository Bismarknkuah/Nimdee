'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { KeyRound, Plus } from 'lucide-react';
import { api, qs } from '@/lib/api';
import { useApi, useDebounce } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { Badge, Button, DataTable, Field, Input, Modal, PageHeader, SearchBox, useToast } from '@/components/ui';

function GuardiansList() {
  const params = useSearchParams();
  const { can } = useAuth();
  const toast = useToast();
  const [search, setSearch] = useState(params.get('search') ?? '');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<any>({ firstName: '', lastName: '', phone: '', email: '', occupation: '', address: '' });
  const q = useDebounce(search);
  const { data, loading, reload } = useApi(`/guardians${qs({ search: q, page, pageSize: 25 })}`);
  const createLogin = async (g: any) => {
    try {
      const r = await api.post(`/guardians/${g.id}/login`, {});
      alert(`Parent login created.\nEmail: ${r.email}\nTemporary password: ${r.temporaryPassword}`);
      reload();
    } catch (e: any) {
      toast.error(e.message);
    }
  };
  return (
    <div>
      <PageHeader
        title="Parents & guardians"
        subtitle={data ? `${data.total} guardians` : undefined}
        actions={
          can('GUARDIAN_MANAGE') && (
            <Button onClick={() => setOpen(true)}>
              <Plus size={16} /> Add guardian
            </Button>
          )
        }
      />
      <div className="mb-4 max-w-md">
        <SearchBox
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Search by name, phone or email"
        />
      </div>
      <DataTable
        rows={data?.items}
        loading={loading}
        page={page}
        pageSize={25}
        total={data?.total}
        onPage={setPage}
        columns={[
          {
            key: 'name',
            header: 'Guardian',
            render: (g: any) => (
              <div>
                <p className="font-medium text-slate-900">
                  {g.firstName} {g.lastName}
                </p>
                <p className="text-xs text-slate-500">{g.occupation ?? ''}</p>
              </div>
            ),
          },
          { key: 'phone', header: 'Phone' },
          { key: 'email', header: 'Email', render: (g: any) => g.email ?? '—' },
          {
            key: 'students',
            header: 'Children',
            render: (g: any) => (
              <div className="flex flex-wrap gap-1">
                {g.students.map((s: any) => (
                  <Link
                    key={s.id}
                    href={`/school/students/${s.id}`}
                    className="rounded-md bg-slate-100 px-2 py-0.5 text-xs hover:bg-brand-soft"
                  >
                    {s.firstName} {s.lastName}
                    {s.class ? ` (${s.class.name})` : ''}
                  </Link>
                ))}
              </div>
            ),
          },
          {
            key: 'portal',
            header: 'Portal login',
            render: (g: any) =>
              g.user ? (
                <Badge>{g.user.isActive ? 'ACTIVE' : 'INACTIVE'}</Badge>
              ) : can('GUARDIAN_MANAGE') ? (
                <button
                  className="flex items-center gap-1 text-xs text-brand hover:underline"
                  onClick={() => createLogin(g)}
                >
                  <KeyRound size={13} /> Create
                </button>
              ) : (
                '—'
              ),
          },
        ]}
      />
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add guardian"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                try {
                  const body: any = { ...f };
                  if (!body.email) delete body.email;
                  await api.post('/guardians', body);
                  toast.success('Guardian added');
                  setOpen(false);
                  reload();
                } catch (e: any) {
                  toast.error(e.message);
                }
              }}
            >
              Save
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            ['firstName', 'First name'],
            ['lastName', 'Last name'],
            ['phone', 'Phone'],
            ['email', 'Email'],
            ['occupation', 'Occupation'],
            ['address', 'Address'],
          ].map(([k, l]) => (
            <Field key={k} label={l}>
              <Input value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
            </Field>
          ))}
        </div>
      </Modal>
    </div>
  );
}
export default function GuardiansPage() {
  return (
    <Suspense>
      <GuardiansList />
    </Suspense>
  );
}
