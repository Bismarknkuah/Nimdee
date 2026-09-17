'use client';
import { useState } from 'react';
import { qs } from '@/lib/api';
import { useApi, useDebounce } from '@/lib/hooks';
import { fmtDateTime, title } from '@/lib/format';
import { Badge, DataTable, Field, Input, PageHeader, SearchBox } from '@/components/ui';

export default function PlatformAudit() {
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const q = useDebounce(search);
  const a = useDebounce(action);
  const { data, loading } = useApi(`/platform/audit${qs({ search: q, action: a, page, pageSize: 50 })}`, [q, a, page]);
  return (
    <div>
      <PageHeader
        title="Platform audit log"
        subtitle="Cross-school view of every audited action, including support sessions"
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Field label="Actor">
          <SearchBox
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
          />
        </Field>
        <Field label="Action contains">
          <Input
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setPage(1);
            }}
            placeholder="e.g. SUPPORT_SESSION"
          />
        </Field>
      </div>
      <DataTable
        rows={data?.items}
        loading={loading}
        page={page}
        pageSize={50}
        total={data?.total}
        onPage={setPage}
        columns={[
          { key: 'createdAt', header: 'When', render: (r: any) => fmtDateTime(r.createdAt) },
          {
            key: 'actorName',
            header: 'Who',
            render: (r: any) => (
              <span>
                {r.actorName} <Badge tone="slate">{r.actorType}</Badge>
              </span>
            ),
          },
          { key: 'action', header: 'Action', render: (r: any) => title(r.action) },
          { key: 'entity', header: 'Entity' },
          {
            key: 'tenantId',
            header: 'School',
            render: (r: any) => <span className="text-xs text-slate-500">{r.tenantId?.slice(0, 8) ?? 'platform'}</span>,
          },
          { key: 'reason', header: 'Reason', render: (r: any) => r.reason ?? '' },
        ]}
      />
    </div>
  );
}
