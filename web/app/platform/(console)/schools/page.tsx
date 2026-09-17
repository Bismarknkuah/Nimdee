'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { qs } from '@/lib/api';
import { useApi, useDebounce } from '@/lib/hooks';
import { ago, num } from '@/lib/format';
import { Badge, DataTable, PageHeader, SearchBox, Select } from '@/components/ui';

function Schools() {
  const params = useSearchParams();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(params.get('status') ?? '');
  const [page, setPage] = useState(1);
  const q = useDebounce(search);
  const { data, loading } = useApi(`/platform/schools${qs({ search: q, status, page, pageSize: 25 })}`, [
    q,
    status,
    page,
  ]);
  return (
    <div>
      <PageHeader title="Schools" subtitle={data ? `${data.total} schools` : undefined} />
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
