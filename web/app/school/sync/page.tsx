'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { useOffline } from '@/lib/offline';
import { ago, fmtDateTime, title } from '@/lib/format';
import { Badge, Button, Card, DataTable, PageHeader, StatCard, Tabs, useToast } from '@/components/ui';

/** Offline devices, pending operations and conflict resolution. */
export default function SyncPage() {
  const toast = useToast();
  const offline = useOffline();
  const [tab, setTab] = useState('devices');
  const devices = useApi('/sync/devices');
  const conflicts = useApi<any[]>(tab === 'conflicts' ? '/sync/conflicts?status=OPEN' : null, [tab]);
  const ops = useApi<any[]>(tab === 'operations' ? '/sync/operations' : null, [tab]);
  const resolve = async (id: string, resolution: 'SERVER' | 'CLIENT') => {
    try {
      await api.post(`/sync/conflicts/${id}/resolve`, { resolution });
      toast.success('Conflict resolved');
      conflicts.reload();
      devices.reload();
    } catch (e: any) {
      toast.error(e.message);
    }
  };
  const toggle = async (d: any) => {
    try {
      await api.post(`/sync/devices/${d.id}/${d.isActive ? 'disable' : 'enable'}`);
      devices.reload();
    } catch (e: any) {
      toast.error(e.message);
    }
  };
  const s = devices.data?.summary;
  return (
    <div>
      <PageHeader
        title="Offline devices & sync"
        subtitle="Every device that marks attendance offline, what it still has to upload, and any conflicts"
        actions={
          <Button
            variant="secondary"
            onClick={() => offline.sync().then(() => devices.reload())}
            loading={offline.syncing}
          >
            Sync this device{offline.pending ? ` (${offline.pending})` : ''}
          </Button>
        }
      />
      {s && (
        <div className="mb-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard label="Devices" value={s.devices} />
          <StatCard label="Online" value={s.online} tone="emerald" />
          <StatCard label="Offline" value={s.offline} tone="amber" />
          <StatCard label="Pending ops" value={s.pendingOperations} tone="sky" />
          <StatCard label="Failed (7d)" value={s.failed7d} tone="red" />
          <StatCard label="Open conflicts" value={s.openConflicts} tone={s.openConflicts ? 'red' : 'emerald'} />
        </div>
      )}
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'devices', label: 'Devices' },
          { id: 'conflicts', label: 'Conflicts', count: s?.openConflicts },
          { id: 'operations', label: 'Operations log' },
        ]}
      />
      {tab === 'devices' && (
        <DataTable
          rows={devices.data?.items}
          loading={devices.loading}
          emptyTitle="No devices registered yet"
          emptyDescription="Devices register automatically the first time a teacher downloads a class for offline use."
          columns={[
            {
              key: 'name',
              header: 'Device',
              render: (d: any) => (
                <div>
                  <p className="font-medium">{d.name}</p>
                  <p className="text-xs text-slate-500">{d.platform}</p>
                </div>
              ),
            },
            { key: 'user', header: 'User', render: (d: any) => d.user?.name ?? '—' },
            { key: 'status', header: 'Status', render: (d: any) => <Badge>{d.status}</Badge> },
            { key: 'pendingCount', header: 'Pending', align: 'right' },
            { key: 'failed7d', header: 'Failed (7d)', align: 'right' },
            { key: 'lastSeenAt', header: 'Last seen', render: (d: any) => ago(d.lastSeenAt) },
            {
              key: 'lastSyncAt',
              header: 'Last sync',
              render: (d: any) => (d.lastSyncAt ? ago(d.lastSyncAt) : 'never'),
            },
            {
              key: 'x',
              header: '',
              render: (d: any) => (
                <button
                  className={`text-xs hover:underline ${d.isActive ? 'text-red-600' : 'text-brand'}`}
                  onClick={() => toggle(d)}
                >
                  {d.isActive ? 'Disable' : 'Enable'}
                </button>
              ),
            },
          ]}
        />
      )}
      {tab === 'conflicts' && (
        <div className="space-y-3">
          {conflicts.data?.map((c) => (
            <Card
              key={c.id}
              title={
                <span>
                  {title(c.entity)} conflict <Badge>{c.status}</Badge>
                </span>
              }
              actions={<span className="text-xs text-slate-500">{fmtDateTime(c.createdAt)}</span>}
            >
              <div className="grid gap-3 sm:grid-cols-2 text-sm">
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="mb-1 text-xs font-semibold text-slate-500">Server value</p>
                  <pre className="whitespace-pre-wrap text-xs">{JSON.stringify(c.serverValue, null, 1)}</pre>
                </div>
                <div className="rounded-lg bg-amber-50 p-3">
                  <p className="mb-1 text-xs font-semibold text-amber-700">Device value</p>
                  <pre className="whitespace-pre-wrap text-xs">{JSON.stringify(c.clientValue, null, 1)}</pre>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <Button variant="secondary" onClick={() => resolve(c.id, 'SERVER')}>
                  Keep server
                </Button>
                <Button onClick={() => resolve(c.id, 'CLIENT')}>Use device value</Button>
              </div>
            </Card>
          ))}
          {conflicts.data && !conflicts.data.length && (
            <Card>
              <p className="py-6 text-center text-sm text-slate-500">No open conflicts. 🎉</p>
            </Card>
          )}
        </div>
      )}
      {tab === 'operations' && (
        <DataTable
          rows={ops.data}
          loading={ops.loading}
          columns={[
            { key: 'createdAt', header: 'Received', render: (o: any) => fmtDateTime(o.createdAt) },
            { key: 'entity', header: 'Operation', render: (o: any) => `${o.entity}.${o.action}` },
            { key: 'clientTimestamp', header: 'Client time', render: (o: any) => fmtDateTime(o.clientTimestamp) },
            { key: 'status', header: 'Status', render: (o: any) => <Badge>{o.status}</Badge> },
            {
              key: 'result',
              header: 'Result',
              render: (o: any) => <span className="text-xs text-slate-500">{o.error ?? JSON.stringify(o.result)}</span>,
            },
          ]}
        />
      )}
    </div>
  );
}
