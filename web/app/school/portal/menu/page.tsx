'use client';
import { useApi } from '@/lib/hooks';
import { Card, PageHeader, Spinner } from '@/components/ui';

const DAYS: { key: string; label: string }[] = [
  { key: 'MONDAY', label: 'Monday' },
  { key: 'TUESDAY', label: 'Tuesday' },
  { key: 'WEDNESDAY', label: 'Wednesday' },
  { key: 'THURSDAY', label: 'Thursday' },
  { key: 'FRIDAY', label: 'Friday' },
];

/** Read-only weekly food timetable for parents and students — the same menu the school publishes,
 *  without the editing controls that live on the staff-side page. */
export default function PortalFoodMenuPage() {
  const { data, loading } = useApi<any>('/portal/canteen-menu');
  if (loading || !data) return <Spinner />;
  const menu = data.weeklyMenu ?? {};
  return (
    <div>
      <PageHeader title="This week's food" subtitle="Published by the school" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {DAYS.map((d) => (
          <Card key={d.key} title={d.label}>
            <p className="text-sm text-slate-600">{menu[d.key] || 'Not published yet'}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
