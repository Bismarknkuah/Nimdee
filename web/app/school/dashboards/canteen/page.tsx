'use client';
import Link from 'next/link';
import { Banknote, ShoppingBasket, Users, Wallet } from 'lucide-react';
import { useApi } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { money } from '@/lib/format';
import { BarSeries } from '@/components/charts';
import { Badge, Card, PageHeader, Spinner, StatCard } from '@/components/ui';

/** Canteen manager dashboard: today's sales, wallets and stock alerts. */
export default function CanteenDashboard() {
  const { me } = useAuth();
  const { data: d, loading } = useApi('/dashboard/canteen');
  if (loading || !d) return <Spinner />;
  const cur = me?.tenant?.currency ?? 'GHS';
  return (
    <div>
      <PageHeader
        title="Canteen"
        subtitle={`Summary for ${d.date}`}
        actions={
          <>
            <Link href="/school/canteen" className="btn-primary">
              <ShoppingBasket size={16} /> Open POS
            </Link>
            <Link href="/school/canteen/items" className="btn-secondary">
              Menu & stock
            </Link>
          </>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Revenue today"
          value={money(d.revenue, cur)}
          hint={`${d.salesCount} sales`}
          icon={<Banknote size={20} />}
          tone="emerald"
        />
        <StatCard
          label="Wallet sales"
          value={money(d.wallet, cur)}
          hint={`cash ${money(d.cash, cur)}`}
          icon={<Wallet size={20} />}
        />
        <StatCard label="Students served" value={d.uniqueStudents} icon={<Users size={20} />} tone="violet" />
        <StatCard
          label="Top-ups today"
          value={money(d.topUpsToday.amount, cur)}
          hint={`${d.topUpsToday.count} top-ups`}
          icon={<Wallet size={20} />}
          tone="sky"
        />
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Card title="Best sellers today" padded={false}>
          {d.topItems.length ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {d.topItems.map((i: any) => (
                  <tr key={i.name}>
                    <td>{i.name}</td>
                    <td className="text-right">{i.quantity}</td>
                    <td className="text-right">{money(i.revenue, cur)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="py-8 text-center text-sm text-slate-500">No sales yet today.</p>
          )}
        </Card>
        <Card title="Low stock" padded={false}>
          {d.lowStock.length ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th className="text-right">Stock</th>
                  <th className="text-right">Minimum</th>
                </tr>
              </thead>
              <tbody>
                {d.lowStock.map((i: any) => (
                  <tr key={i.id}>
                    <td>{i.name}</td>
                    <td className="text-right">
                      <Badge tone="red">{`${i.stock} ${i.unit}`}</Badge>
                    </td>
                    <td className="text-right">{i.minStock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="py-8 text-center text-sm text-slate-500">All items are well stocked.</p>
          )}
        </Card>
      </div>
      <Card title="Last 7 days" className="mt-5">
        <BarSeries
          data={d.last7Days.map((x: any) => ({ mode: x.mode, amount: Number(x.amount), count: x.count }))}
          x="mode"
          bars={[{ key: 'amount', name: `Sales (${cur})` }]}
          height={180}
        />
      </Card>
    </div>
  );
}
