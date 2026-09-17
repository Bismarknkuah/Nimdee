'use client';
import Link from 'next/link';
import { useApi } from '@/lib/hooks';
import { ago } from '@/lib/format';
import { Badge, DataTable, PageHeader } from '@/components/ui';

export default function PlatformSync() {
  const { data, loading } = useApi<any[]>('/platform/sync-overview');
  return (
    <div>
      <PageHeader title="Sync health" subtitle="Schools using offline devices, pending uploads and conflicts" />
      <DataTable
        rows={data}
        loading={loading}
        keyField="tenant"
        emptyTitle="No schools have registered offline devices yet"
        columns={[
          {
            key: 'tenant',
            header: 'School',
            render: (r: any) => (
              <Link href={`/platform/schools/${r.tenant.id}`} className="text-brand hover:underline">
                {r.tenant.name}
              </Link>
            ),
          },
          { key: 'devices', header: 'Devices', align: 'right' },
          { key: 'offlineDevices', header: 'Offline > 24h', align: 'right' },
          {
            key: 'pendingOperations',
            header: 'Pending ops',
            align: 'right',
            render: (r: any) => (r.pendingOperations ? <Badge tone="amber">{String(r.pendingOperations)}</Badge> : '0'),
          },
          {
            key: 'openConflicts',
            header: 'Conflicts',
            align: 'right',
            render: (r: any) => (r.openConflicts ? <Badge tone="red">{String(r.openConflicts)}</Badge> : '0'),
          },
          { key: 'failedOps7d', header: 'Failed (7d)', align: 'right' },
          { key: 'lastSeenAt', header: 'Last seen', render: (r: any) => (r.lastSeenAt ? ago(r.lastSeenAt) : '—') },
        ]}
      />
    </div>
  );
}
