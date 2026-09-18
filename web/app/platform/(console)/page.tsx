'use client';
import Link from 'next/link';
import { Building2, CreditCard, GraduationCap, RefreshCw, Users } from 'lucide-react';
import { useApi } from '@/lib/hooks';
import { ago, money, num, title } from '@/lib/format';
import { BarSeries, Donut } from '@/components/charts';
import { Badge, Card, PageHeader, Spinner, StatCard } from '@/components/ui';

/** Platform owner overview: every school, subscription revenue and sync health. */
export default function PlatformOverview() {
  const { data: d, loading } = useApi('/platform/stats');
  if (loading || !d) return <Spinner />;
  return (
    <div>
      <PageHeader title="Platform overview" subtitle="All schools on Nimdee" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Schools"
          value={num(d.totals.schools)}
          hint={`${d.schools.ACTIVE ?? 0} active · ${d.schools.PENDING ?? 0} pending`}
          icon={<Building2 size={20} />}
        />
        <StatCard
          label="Students"
          value={num(d.totals.students)}
          hint={`${num(d.totals.staff)} staff`}
          icon={<GraduationCap size={20} />}
          tone="emerald"
        />
        <StatCard
          label="Users"
          value={num(d.totals.users)}
          hint={`${d.totals.activeSchoolsToday} schools active today`}
          icon={<Users size={20} />}
          tone="violet"
        />
        <StatCard
          label="Subscription revenue"
          value={money(d.revenue.collected)}
          hint={`${d.revenue.pendingInvoices} pending invoices`}
          icon={<CreditCard size={20} />}
          tone="amber"
        />
        <StatCard
          label="Sync"
          value={d.sync.devicesActive30d}
          hint={`${d.sync.schoolsWithPendingSync} schools pending · ${d.sync.openConflicts} conflicts`}
          icon={<RefreshCw size={20} />}
          tone="sky"
        />
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <Card title="Subscriptions by status">
          <Donut
            data={Object.entries(d.subscriptions.byStatus).map(([k, v]) => ({ name: title(k), value: v as number }))}
          />
        </Card>
        <Card title="Schools by plan">
          <BarSeries data={d.subscriptions.byPlan} x="plan" bars={[{ key: 'count', name: 'Schools' }]} height={200} />
        </Card>
        <Card title="Recent registrations" padded={false}>
          <ul className="divide-y divide-slate-100 text-sm">
            {d.recentSchools.map((s: any) => (
              <li key={s.id} className="flex items-center justify-between px-4 py-2">
                <Link href={`/platform/schools/${s.id}`} className="font-medium text-brand hover:underline">
                  {s.name}
                </Link>
                <span className="flex items-center gap-2 text-xs text-slate-500">
                  <Badge>{s.status}</Badge>
                  {ago(s.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      {d.schools.PENDING > 0 && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {d.schools.PENDING} school(s) waiting for approval.{' '}
          <Link href="/platform/schools?status=PENDING" className="font-semibold underline">
            Review now
          </Link>
        </div>
      )}
    </div>
  );
}
