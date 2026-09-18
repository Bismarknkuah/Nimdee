'use client';
import Link from 'next/link';
import { AlertTriangle, Banknote, CreditCard, PiggyBank, Receipt } from 'lucide-react';
import { useApi } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { fmtDateTime, money, pct, title } from '@/lib/format';
import { BarSeries, Donut, LineSeries } from '@/components/charts';
import { Card, KeyStat, PageHeader, SectionTitle, Spinner, StatCard } from '@/components/ui';

/** Finance dashboard for accountants and bursars. */
export default function FinanceDashboard() {
  const { me } = useAuth();
  const { data: d, loading } = useApi('/dashboard/finance');
  const { data: rep } = useApi('/reports/finance');
  if (loading || !d) return <Spinner />;
  const cur = me?.tenant?.currency ?? 'GHS';
  return (
    <div>
      <PageHeader
        title="Finance"
        subtitle={d.term ? `${d.term.name} collections` : 'No current term'}
        actions={
          <>
            <Link href="/school/fees/payments/new" className="btn-primary">
              <Receipt size={16} /> Record payment
            </Link>
            <Link href="/school/fees" className="btn-secondary">
              Invoices
            </Link>
          </>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Invoiced" value={money(d.invoiced, cur)} icon={<CreditCard size={20} />} />
        <StatCard
          label="Collected"
          value={money(d.collected, cur)}
          hint={`${pct(d.collectionRate)} collection rate`}
          icon={<PiggyBank size={20} />}
          tone="emerald"
        />
        <StatCard
          label="Outstanding"
          value={money(d.outstanding, cur)}
          hint={`${d.overdueCount} overdue invoices`}
          icon={<AlertTriangle size={20} />}
          tone="amber"
        />
        <StatCard
          label="Today"
          value={money(d.today, cur)}
          hint="received today"
          icon={<Banknote size={20} />}
          tone="sky"
        />
      </div>
      {rep && (
        <>
          <SectionTitle>Outstanding by age</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-5">
            {['current', '1-30', '31-60', '61-90', '90+'].map((k) => (
              <KeyStat
                key={k}
                label={k === 'current' ? 'Not yet due' : `${k} days overdue`}
                value={money(rep.ageing[k], cur)}
                tone={k === 'current' ? 'brand' : k === '90+' ? 'red' : 'amber'}
              />
            ))}
          </div>
        </>
      )}
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <Card title="Collections: last 30 days" className="lg:col-span-2">
          {d.trend.length ? (
            <LineSeries data={d.trend} x="date" lines={[{ key: 'amount', name: `Received (${cur})` }]} />
          ) : (
            <p className="py-8 text-center text-sm text-slate-500">No payments yet.</p>
          )}
        </Card>
        <Card title="By payment method">
          {d.byMethod.length ? (
            <Donut data={d.byMethod.map((m: any) => ({ name: title(m.method), value: Number(m.amount) }))} />
          ) : (
            <p className="py-8 text-center text-sm text-slate-500">No payments yet.</p>
          )}
        </Card>
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Card title="Collection by class">
          {d.byClass.length ? (
            <BarSeries
              data={d.byClass.map((c: any) => ({
                name: c.name,
                Invoiced: Number(c.invoiced),
                Collected: Number(c.collected),
              }))}
              x="name"
              bars={[{ key: 'Invoiced', color: '#cbd5e1' }, { key: 'Collected' }]}
            />
          ) : (
            <p className="py-8 text-center text-sm text-slate-500">Generate invoices to see this chart.</p>
          )}
        </Card>
        <Card title="Top outstanding balances" padded={false}>
          <table className="table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Class</th>
                <th className="text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              {d.topDebtors.map((a: any) => (
                <tr key={a.id}>
                  <td>
                    <Link href={`/school/students/${a.student.id}`} className="text-brand hover:underline">
                      {a.student.firstName} {a.student.lastName}
                    </Link>{' '}
                    <span className="text-xs text-slate-500">{a.student.studentId}</span>
                  </td>
                  <td>{a.student.class?.name}</td>
                  <td className="text-right font-medium text-red-700">{money(a.balance, cur)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
      <SectionTitle>Quick actions</SectionTitle>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {[
          { href: '/school/fees/payments/new', label: 'Record payment' },
          { href: '/school/fees', label: 'Invoices' },
          { href: '/school/fees?tab=structures', label: 'Fee structures' },
          { href: '/school/reports?tab=finance', label: 'Finance report' },
          { href: '/school/canteen/wallets', label: 'Wallet top-up' },
          { href: '/school/hr', label: 'Payroll' },
        ].map((q) => (
          <Link
            key={q.href}
            href={q.href}
            className="card p-3 text-center text-xs font-medium text-slate-700 hover:border-brand hover:text-brand-dark"
          >
            {q.label}
          </Link>
        ))}
      </div>
      <Card title="Recent payments" className="mt-5" padded={false}>
        <table className="table">
          <thead>
            <tr>
              <th>Receipt</th>
              <th>Student</th>
              <th>Method</th>
              <th className="text-right">Amount</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {d.recentPayments.map((p: any) => (
              <tr key={p.id}>
                <td>
                  <Link href={`/school/fees/payments/${p.id}`} className="text-brand hover:underline">
                    {p.receiptNumber}
                  </Link>
                </td>
                <td>
                  {p.student.firstName} {p.student.lastName}
                </td>
                <td>{title(p.method)}</td>
                <td className="text-right">{money(p.amount, cur)}</td>
                <td>{fmtDateTime(p.paidAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
