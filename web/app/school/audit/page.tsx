'use client';
import { useState } from 'react';
import { qs } from '@/lib/api';
import { useApi, useDebounce } from '@/lib/hooks';
import { fmtDateTime, title } from '@/lib/format';
import { Badge, DataTable, Field, Input, PageHeader, SearchBox } from '@/components/ui';

export default function AuditPage() {
  const [search, setSearch] = useState('');
  const [entity, setEntity] = useState('');
  const [page, setPage] = useState(1);
  const q = useDebounce(search);
  const { data, loading } = useApi(`/audit${qs({ search: q, entity, page, pageSize: 50 })}`, [q, entity, page]);
  return (
    <div>
      <PageHeader title="Audit log" subtitle="Every sensitive action, who did it and what changed — immutable" />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Field label="Search actor or action">
          <SearchBox
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
          />
        </Field>
        <Field label="Entity">
          <Input
            value={entity}
            onChange={(e) => {
              setEntity(e.target.value);
              setPage(1);
            }}
            placeholder="e.g. Payment"
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
          {
            key: 'createdAt',
            header: 'When',
            render: (a: any) => <span className="whitespace-nowrap">{fmtDateTime(a.createdAt)}</span>,
          },
          {
            key: 'actorName',
            header: 'Who',
            render: (a: any) => (
              <span>
                {a.actorName} <span className="text-xs text-slate-400">{a.actorType}</span>
              </span>
            ),
          },
          {
            key: 'action',
            header: 'Action',
            render: (a: any) => (
              <Badge
                tone={
                  /DELETE|REVERS|REJECT|SUSPEND/.test(a.action)
                    ? 'red'
                    : /CREATE|PUBLISH|APPROVE|PAID/.test(a.action)
                      ? 'emerald'
                      : 'slate'
                }
              >
                {title(a.action)}
              </Badge>
            ),
          },
          {
            key: 'entity',
            header: 'Entity',
            render: (a: any) => (
              <span>
                {a.entity} <span className="text-xs text-slate-400">{a.entityId?.slice(0, 8)}</span>
              </span>
            ),
          },
          {
            key: 'change',
            header: 'Details',
            render: (a: any) => (
              <details className="text-xs">
                <summary className="cursor-pointer text-slate-500">{a.reason ?? 'view'}</summary>
                <pre className="mt-1 max-w-md whitespace-pre-wrap rounded bg-slate-50 p-2">
                  {JSON.stringify({ before: a.before, after: a.after }, null, 1)}
                </pre>
              </details>
            ),
          },
          { key: 'ip', header: 'IP', render: (a: any) => <span className="text-xs text-slate-400">{a.ip ?? ''}</span> },
        ]}
      />
    </div>
  );
}
