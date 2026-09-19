'use client';
import Link from 'next/link';
import {
  ArrowUpRight,
  Banknote,
  Building2,
  Crown,
  GraduationCap,
  Percent,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
} from 'lucide-react';
import { useApi } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { ago, fmtDate, money, num, pct, title } from '@/lib/format';
import { BarSeries, Donut } from '@/components/charts';
import { Badge, Card, KeyStat, PageHeader, ProgressBar, SectionTitle, Spinner, StatCard } from '@/components/ui';

/**
 * Proprietor dashboard: an owner's view of the school. The business picture rather than the
 * operational one. Enrolment and revenue trends, subscription and billing, staff headcount and
 * a light touch on what's happening, with links out to the full reports and settings.
 */
export default function ProprietorDashboard() {
  const { me, can } = useAuth();
  const cur = me?.tenant?.currency ?? 'GHS';
  const { data: d, loading } = useApi('/dashboard/school');
  const { data: enrolment } = useApi('/reports/enrolment');
  const { data: finance } = useApi('/reports/finance');
  const { data: sub } = useApi(can('SUBSCRIPTION_MANAGE') ? '/subscription' : null);
  const { data: expenseSummary } = useApi<any>(can('EXPENSE_VIEW') ? '/expenses/summary' : null);
  if (loading || !d) return <Spinner />;

  const netThisYear = finance ? finance.collectionsByMonth.reduce((a: number, m: any) => a + m.fees + m.wallet, 0) : null;
  const ageing = finance?.ageing;
  const ageingChart = ageing
    ? [
        { name: 'Not yet due', value: ageing.current },
        { name: '1–30 days', value: ageing['1-30'] },
        { name: '31–60 days', value: ageing['31-60'] },
        { name: '61–90 days', value: ageing['61-90'] },
        { name: '90+ days', value: ageing['90+'] },
      ].filter((x) => x.value > 0)
    : [];

  return (
    <div>
      <PageHeader
        title={`Welcome, ${me?.user.firstName}`}
        subtitle={`${d.school.name} · owner overview`}
        actions={
          <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <Crown size={14} className="text-amber-500" /> {d.school.plan} plan · <Badge>{d.school.subscriptionStatus}</Badge>
          </span>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Students"
          value={num(d.counts.students)}
          hint={
            d.counts.byResidency
              ? `${d.counts.byResidency.day} day · ${d.counts.byResidency.boarding} boarding`
              : `${d.counts.classes} classes`
          }
          icon={<GraduationCap size={20} />}
        />
        <StatCard
          label="Staff"
          value={num(d.counts.staff)}
          hint={`${d.staffOnLeave} on leave today`}
          icon={<Users size={20} />}
          tone="violet"
        />
        <StatCard
          label="Collected this term"
          value={d.fees ? money(d.fees.collected, cur) : '—'}
          hint={d.fees ? `${pct(d.fees.collectionRate)} of ${money(d.fees.invoiced, cur)} invoiced` : 'Fees module off'}
          icon={<Banknote size={20} />}
          tone="emerald"
        />
        <StatCard
          label="Outstanding"
          value={d.fees ? money(d.fees.outstanding, cur) : '—'}
          hint={d.fees ? `${d.fees.overdueCount} invoice(s) overdue` : ''}
          icon={<Percent size={20} />}
          tone="red"
        />
        <StatCard
          label="Collected (12 months)"
          value={netThisYear !== null ? money(netThisYear, cur) : '—'}
          hint="Fees + canteen wallet top-ups"
          icon={<ArrowUpRight size={20} />}
          tone="amber"
        />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <Card title="Revenue: last 12 months" className="lg:col-span-2">
          {finance?.collectionsByMonth?.length ? (
            <BarSeries
              data={finance.collectionsByMonth}
              x="month"
              bars={[
                { key: 'fees', name: 'School fees' },
                { key: 'wallet', name: 'Canteen top-ups', color: '#8b5cf6' },
              ]}
              stacked
            />
          ) : (
            <p className="py-8 text-center text-sm text-slate-500">No payments recorded yet.</p>
          )}
        </Card>
        <Card title="Outstanding by age">
          {ageingChart.length ? (
            <Donut data={ageingChart} />
          ) : (
            <p className="py-8 text-center text-sm text-slate-500">Nothing outstanding, fully collected.</p>
          )}
        </Card>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <Card title="Enrolment: admissions by month" className="lg:col-span-2">
          {enrolment?.admissionsByMonth?.length ? (
            <BarSeries data={enrolment.admissionsByMonth} x="month" bars={[{ key: 'count', name: 'New students' }]} />
          ) : (
            <p className="py-8 text-center text-sm text-slate-500">No admissions recorded in the last 12 months.</p>
          )}
        </Card>
        <Card title="Students by level">
          {enrolment?.byLevel?.length ? (
            <Donut data={enrolment.byLevel.map((l: any) => ({ name: title(l.level), value: l.students }))} />
          ) : (
            <p className="py-8 text-center text-sm text-slate-500">No classes yet.</p>
          )}
        </Card>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        {sub && (
          <Card
            title={
              <span className="flex items-center gap-1.5">
                <Sparkles size={15} className="text-brand" /> Subscription &amp; billing
              </span>
            }
            actions={
              <Link href="/school/settings?tab=subscription" className="text-xs text-brand hover:underline">
                Manage
              </Link>
            }
          >
            <div className="grid grid-cols-2 gap-3">
              <KeyStat label="Plan" value={sub.subscription?.plan?.name ?? d.school.plan} />
              <KeyStat
                label="Renews in"
                value={sub.daysLeft !== null ? `${sub.daysLeft}d` : '—'}
                sub={sub.subscription?.currentPeriodEnd ? fmtDate(sub.subscription.currentPeriodEnd) : undefined}
              />
            </div>
            <div className="mt-3">
              <ProgressBar
                value={sub.usage.studentUsagePercent}
                tone={sub.usage.studentUsagePercent > 90 ? 'red' : 'brand'}
                label={`${sub.usage.students} / ${sub.usage.studentLimit || '∞'} students`}
              />
            </div>
            {sub.subscription?.invoices?.[0] && (
              <p className="mt-3 text-xs text-slate-500">
                Last invoice: {money(sub.subscription.invoices[0].amount, cur)} ·{' '}
                <Badge tone={sub.subscription.invoices[0].status === 'PAID' ? 'emerald' : 'amber'}>
                  {sub.subscription.invoices[0].status}
                </Badge>
              </p>
            )}
          </Card>
        )}
        <Card title="Operations at a glance" className={sub ? '' : 'lg:col-span-2'}>
          <div className="grid grid-cols-2 gap-3">
            <KeyStat
              label="Attendance today"
              value={d.attendanceToday ? pct(d.attendanceToday.rate) : '—'}
              tone={d.attendanceToday && d.attendanceToday.rate >= 90 ? 'emerald' : 'amber'}
            />
            <KeyStat
              label="Behaviour"
              value={d.openIncidents}
              sub="open incidents"
              tone={d.openIncidents ? 'amber' : 'emerald'}
            />
            <KeyStat
              label="Offline sync"
              value={d.sync.openConflicts}
              sub="conflicts pending"
              tone={d.sync.openConflicts ? 'red' : 'emerald'}
            />
            <KeyStat
              label="HR"
              value={d.pendingLeave}
              sub="leave requests pending"
              tone={d.pendingLeave ? 'amber' : 'emerald'}
            />
          </div>
        </Card>
        <Card
          title={
            <span className="flex items-center gap-1.5">
              <ShieldCheck size={15} className="text-violet-600" /> Recent activity
            </span>
          }
          padded={false}
          actions={
            <Link href="/school/audit" className="text-xs text-brand hover:underline">
              Full log
            </Link>
          }
        >
          <ul className="divide-y divide-slate-100 text-sm">
            {(d.recentAudit ?? []).slice(0, 6).map((a: any) => (
              <li key={a.id} className="flex items-center justify-between px-4 py-2">
                <span>
                  <Badge tone="slate">{title(a.action)}</Badge> <span className="text-slate-500">{a.entity}</span>
                </span>
                <span className="text-xs text-slate-500">{ago(a.createdAt)}</span>
              </li>
            ))}
            {!d.recentAudit?.length && <li className="px-4 py-6 text-center text-slate-500">Nothing recorded yet</li>}
          </ul>
        </Card>
      </div>

      {expenseSummary && (
        <>
          <SectionTitle>Expenses</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-3">
            <KeyStat
              label="Awaiting approval"
              value={money(expenseSummary.pending.total, cur)}
              sub={`${expenseSummary.pending.count} expense(s)`}
              tone="amber"
            />
            <KeyStat
              label="Approved"
              value={money(expenseSummary.approved.total, cur)}
              sub={`${expenseSummary.approved.count} expense(s)`}
              tone="emerald"
            />
            <KeyStat
              label="Rejected"
              value={money(expenseSummary.rejected.total, cur)}
              sub={`${expenseSummary.rejected.count} expense(s)`}
              tone="red"
            />
          </div>
        </>
      )}

      <SectionTitle>Owner shortcuts</SectionTitle>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Link
          href="/school/reports"
          className="card flex flex-col items-center gap-2 p-3 text-center text-xs font-medium text-slate-700 hover:border-brand hover:text-brand-dark"
        >
          <ArrowUpRight size={20} className="text-brand" /> Full reports
        </Link>
        {can('EXPENSE_VIEW') && (
          <Link
            href="/school/expenses"
            className="card flex flex-col items-center gap-2 p-3 text-center text-xs font-medium text-slate-700 hover:border-brand hover:text-brand-dark"
          >
            <Banknote size={20} className="text-brand" /> Expenses
          </Link>
        )}
        {can('SUBSCRIPTION_MANAGE') && (
          <Link
            href="/school/settings?tab=subscription"
            className="card flex flex-col items-center gap-2 p-3 text-center text-xs font-medium text-slate-700 hover:border-brand hover:text-brand-dark"
          >
            <Wallet size={20} className="text-brand" /> Subscription
          </Link>
        )}
        {can('SCHOOL_MANAGE') && (
          <Link
            href="/school/settings?tab=data"
            className="card flex flex-col items-center gap-2 p-3 text-center text-xs font-medium text-slate-700 hover:border-brand hover:text-brand-dark"
          >
            <ShieldCheck size={20} className="text-brand" /> Data &amp; backup
          </Link>
        )}
        <Link
          href="/school/website"
          className="card flex flex-col items-center gap-2 p-3 text-center text-xs font-medium text-slate-700 hover:border-brand hover:text-brand-dark"
        >
          <Building2 size={20} className="text-brand" /> School website
        </Link>
      </div>
    </div>
  );
}
