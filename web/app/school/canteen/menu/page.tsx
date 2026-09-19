'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { Button, Card, Field, PageHeader, Textarea, useToast } from '@/components/ui';

const DAYS: { key: string; label: string }[] = [
  { key: 'MONDAY', label: 'Monday' },
  { key: 'TUESDAY', label: 'Tuesday' },
  { key: 'WEDNESDAY', label: 'Wednesday' },
  { key: 'THURSDAY', label: 'Thursday' },
  { key: 'FRIDAY', label: 'Friday' },
];

export default function FoodMenuPage() {
  const { can } = useAuth();
  const toast = useToast();
  const { data, loading, reload } = useApi<any>('/canteen/plans/menu');
  const [menu, setMenu] = useState<Record<string, string> | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (data) setMenu(data.weeklyMenu ?? {});
  }, [data]);
  const save = async () => {
    setBusy(true);
    try {
      await api.patch('/canteen/plans/menu', { weeklyMenu: menu });
      toast.success('Food timetable published');
      reload();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  const canManage = can('CANTEEN_MANAGE');
  return (
    <div>
      <PageHeader
        title="Food timetable"
        subtitle="What's served each school day — visible to parents and students in the portal"
        actions={
          canManage && (
            <Button onClick={save} loading={busy}>
              Publish
            </Button>
          )
        }
      />
      {loading || menu === null ? (
        <Card>Loading…</Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {DAYS.map((d) => (
            <Card key={d.key} title={d.label}>
              {canManage ? (
                <Textarea
                  value={menu[d.key] ?? ''}
                  onChange={(e) => setMenu({ ...menu, [d.key]: e.target.value })}
                  placeholder="e.g. Jollof rice with chicken and salad"
                  className="min-h-[80px]"
                />
              ) : (
                <p className="text-sm text-slate-600">{menu[d.key] || 'Not published yet'}</p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
