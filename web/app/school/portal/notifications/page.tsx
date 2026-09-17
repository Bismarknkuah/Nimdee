'use client';
import { api } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { ago } from '@/lib/format';
import { Badge, Button, Card, EmptyState, PageHeader, Spinner } from '@/components/ui';

export default function NotificationsPage() {
  const { data, loading, reload } = useApi('/notifications/me');
  if (loading || !data) return <Spinner />;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Notifications"
        subtitle={`${data.unread} unread`}
        actions={
          data.unread > 0 && (
            <Button
              variant="secondary"
              onClick={async () => {
                await api.post('/notifications/read-all');
                reload();
              }}
            >
              Mark all read
            </Button>
          )
        }
      />
      <Card padded={false}>
        {data.items.length ? (
          <ul className="divide-y divide-slate-100">
            {data.items.map((n: any) => (
              <li
                key={n.id}
                className={`flex gap-3 p-4 ${n.readAt ? '' : 'bg-brand-soft/40'}`}
                onClick={async () => {
                  if (!n.readAt) {
                    await api.post(`/notifications/${n.id}/read`);
                    reload();
                  }
                }}
              >
                <div className="flex-1">
                  <p className="font-medium text-slate-900">
                    {n.title} <Badge tone="slate">{n.type}</Badge>
                  </p>
                  <p className="mt-0.5 text-sm text-slate-600">{n.body}</p>
                </div>
                <span className="whitespace-nowrap text-xs text-slate-400">{ago(n.createdAt)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No notifications yet" />
        )}
      </Card>
    </div>
  );
}
