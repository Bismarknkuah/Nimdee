'use client';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { api, qs } from '@/lib/api';
import { useApi, useDebounce } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { fmtDateTime, money, title } from '@/lib/format';
import {
  Avatar,
  Badge,
  Button,
  Card,
  Field,
  Input,
  PageHeader,
  SearchBox,
  Select,
  Spinner,
  useToast,
} from '@/components/ui';

function Wallets() {
  const params = useSearchParams();
  const toast = useToast();
  const { me, can } = useAuth();
  const cur = me?.tenant?.currency ?? 'GHS';
  const [search, setSearch] = useState('');
  const q = useDebounce(search);
  const [studentId, setStudentId] = useState(params.get('studentId') ?? '');
  const { data: results } = useApi(q.length >= 2 ? `/students${qs({ search: q, pageSize: 8 })}` : null, [q]);
  const { data: w, loading, reload } = useApi(studentId ? `/canteen/wallets/${studentId}` : null, [studentId]);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('CASH');
  const [ref, setRef] = useState('');
  const [limit, setLimit] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (w) setLimit(w.wallet.dailyLimit ? String(Number(w.wallet.dailyLimit)) : '');
  }, [w]);
  const topup = async () => {
    setBusy(true);
    try {
      await api.post(`/canteen/wallets/${studentId}/topup`, {
        amount: Number(amount),
        method,
        reference: ref || undefined,
      });
      toast.success('Wallet topped up');
      setAmount('');
      setRef('');
      reload();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  const saveSettings = async (isActive?: boolean) => {
    try {
      await api.patch(`/canteen/wallets/${studentId}`, {
        dailyLimit: limit === '' ? null : Number(limit),
        ...(isActive !== undefined ? { isActive } : {}),
      });
      toast.success('Wallet settings saved');
      reload();
    } catch (e: any) {
      toast.error(e.message);
    }
  };
  return (
    <div>
      <PageHeader title="Canteen wallets" subtitle="Top up student wallets and set daily spending limits" />
      <div className="mb-4 max-w-md">
        <SearchBox value={search} onChange={setSearch} placeholder="Find a student…" />
        {results?.items?.length > 0 && (
          <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
            {results.items.map((s: any) => (
              <li key={s.id}>
                <button
                  className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                  onClick={() => {
                    setStudentId(s.id);
                    setSearch('');
                  }}
                >
                  {s.firstName} {s.lastName}{' '}
                  <span className="text-slate-500">
                    · {s.studentId} · {s.class?.name}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {loading && <Spinner />}
      {w && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4">
            <Card>
              <div className="flex items-center gap-3">
                <Avatar name={`${w.student.firstName} ${w.student.lastName}`} src={w.student.photoUrl} size="lg" />
                <div>
                  <p className="font-semibold">
                    {w.student.firstName} {w.student.lastName}
                  </p>
                  <p className="text-xs text-slate-500">
                    {w.student.studentId} · {w.student.class?.name}
                  </p>
                </div>
              </div>
              <p className="mt-4 text-xs text-slate-500">Balance</p>
              <p className="text-3xl font-semibold">{money(w.wallet.balance, cur)}</p>
              <p className="text-xs text-slate-500">
                Spent today {money(w.spentToday, cur)} {!w.wallet.isActive && <Badge tone="red">FROZEN</Badge>}
              </p>
            </Card>
            {can('WALLET_TOPUP') && (
              <Card title="Top up">
                <div className="space-y-3">
                  <Field label={`Amount (${cur})`}>
                    <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
                  </Field>
                  <Field label="Method">
                    <Select
                      value={method}
                      onChange={(e) => setMethod(e.target.value)}
                      options={['CASH', 'MOBILE_MONEY', 'CARD', 'BANK_TRANSFER'].map((m) => ({
                        value: m,
                        label: title(m),
                      }))}
                    />
                  </Field>
                  <Field label="Reference">
                    <Input value={ref} onChange={(e) => setRef(e.target.value)} />
                  </Field>
                  <Button className="w-full" onClick={topup} loading={busy} disabled={!amount}>
                    Top up
                  </Button>
                </div>
              </Card>
            )}
            {can('CANTEEN_MANAGE') && (
              <Card title="Limits">
                <Field
                  label={`Daily spending limit (${cur})`}
                  hint={`Blank = school default (${w.defaultDailyLimit || 'none'})`}
                >
                  <Input type="number" value={limit} onChange={(e) => setLimit(e.target.value)} />
                </Field>
                <div className="mt-3 flex gap-2">
                  <Button variant="secondary" onClick={() => saveSettings()}>
                    Save
                  </Button>
                  <Button
                    variant={w.wallet.isActive ? 'danger' : 'primary'}
                    onClick={() => saveSettings(!w.wallet.isActive)}
                  >
                    {w.wallet.isActive ? 'Freeze wallet' : 'Unfreeze'}
                  </Button>
                </div>
              </Card>
            )}
          </div>
          <Card title="Transactions" className="lg:col-span-2" padded={false}>
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Detail</th>
                  <th className="text-right">Amount</th>
                  <th className="text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {w.wallet.transactions.map((t: any) => (
                  <tr key={t.id}>
                    <td className="whitespace-nowrap">{fmtDateTime(t.createdAt)}</td>
                    <td>
                      <Badge tone={t.type === 'PURCHASE' ? 'amber' : t.type === 'TOPUP' ? 'emerald' : 'slate'}>
                        {t.type}
                      </Badge>
                    </td>
                    <td className="text-xs text-slate-500">
                      {t.method ?? ''} {t.reference ?? ''}
                    </td>
                    <td className={`text-right ${t.type === 'PURCHASE' ? 'text-red-700' : 'text-emerald-700'}`}>
                      {t.type === 'PURCHASE' ? '−' : '+'}
                      {money(Math.abs(Number(t.amount)), cur)}
                    </td>
                    <td className="text-right">{money(t.balanceAfter, cur)}</td>
                  </tr>
                ))}
                {!w.wallet.transactions.length && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-500">
                      No transactions yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
        </div>
      )}
    </div>
  );
}
export default function WalletsPage() {
  return (
    <Suspense>
      <Wallets />
    </Suspense>
  );
}
