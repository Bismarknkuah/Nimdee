'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Minus, Plus, ScanLine, Trash2 } from 'lucide-react';
import { api, qs } from '@/lib/api';
import { useApi, useDebounce } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { money } from '@/lib/format';
import { Alert, Avatar, Button, Card, Input, PageHeader, SearchBox, useToast } from '@/components/ui';

/** Point of sale: pick items, choose the student (wallet) or cash, charge. */
export default function CanteenPOS() {
  const toast = useToast();
  const { me } = useAuth();
  const cur = me?.tenant?.currency ?? 'GHS';
  const { data: items, loading, reload } = useApi<any[]>('/canteen/items');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [search, setSearch] = useState('');
  const q = useDebounce(search);
  const { data: results } = useApi(q.length >= 2 ? `/students${qs({ search: q, pageSize: 6 })}` : null, [q]);
  const [student, setStudent] = useState<any>(null);
  const { data: wallet, reload: reloadWallet } = useApi(student ? `/canteen/wallets/${student.id}` : null, [
    student?.id,
  ]);
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<any>(null);
  const [qr, setQr] = useState('');
  const total = useMemo(
    () => Object.entries(cart).reduce((s, [id, n]) => s + n * Number(items?.find((i) => i.id === id)?.price ?? 0), 0),
    [cart, items],
  );
  const add = (id: string, d: number) =>
    setCart((c) => {
      const n = (c[id] ?? 0) + d;
      const next = { ...c };
      if (n <= 0) delete next[id];
      else next[id] = n;
      return next;
    });
  const charge = async (paymentMode: 'WALLET' | 'CASH') => {
    setBusy(true);
    try {
      const s = await api.post('/canteen/sales', {
        studentId: student?.id,
        paymentMode,
        items: Object.entries(cart).map(([itemId, quantity]) => ({ itemId, quantity })),
      });
      setLast({ ...s, mode: paymentMode });
      setCart({});
      toast.success(`Sale of ${money(s.total, cur)} recorded`);
      reload();
      if (student) reloadWallet();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  const scan = async () => {
    try {
      const r = await api.post('/students/verify-qr', { payload: qr.trim() });
      if (!r.valid) return toast.error(`Card belongs to an inactive student (${r.student.status})`);
      setStudent({
        id: r.student.id,
        firstName: r.student.firstName,
        lastName: r.student.lastName,
        studentId: r.student.studentId,
        class: r.student.class,
      });
      setQr('');
    } catch (e: any) {
      toast.error(e.message);
    }
  };
  const groups = useMemo(() => {
    const g: Record<string, any[]> = {};
    (items ?? []).forEach((i) => (g[i.category] = [...(g[i.category] ?? []), i]));
    return g;
  }, [items]);
  return (
    <div>
      <PageHeader
        title="Canteen point of sale"
        actions={
          <>
            <Link href="/school/canteen/items" className="btn-secondary">
              Menu & stock
            </Link>
            <Link href="/school/canteen/wallets" className="btn-secondary">
              Wallets
            </Link>
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {loading
            ? null
            : Object.entries(groups).map(([cat, list]) => (
                <div key={cat} className="mb-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{cat}</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                    {list.map((i) => (
                      <button
                        key={i.id}
                        onClick={() => add(i.id, 1)}
                        disabled={i.stock <= 0}
                        className="card flex flex-col items-start p-3 text-left hover:border-brand disabled:opacity-40"
                      >
                        <span className="font-medium text-slate-900">{i.name}</span>
                        <span className="text-sm text-brand-dark">{money(i.price, cur)}</span>
                        <span className={`text-xs ${i.stock <= i.minStock ? 'text-amber-600' : 'text-slate-400'}`}>
                          {i.stock} {i.unit} left
                        </span>
                        {cart[i.id] && (
                          <span className="mt-1 rounded-full bg-brand px-2 text-xs text-white">×{cart[i.id]}</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
        </div>
        <div className="space-y-4">
          <Card title="Student">
            {student ? (
              <div className="flex items-center gap-3">
                <Avatar name={`${student.firstName} ${student.lastName}`} />
                <div className="flex-1">
                  <p className="font-medium">
                    {student.firstName} {student.lastName}
                  </p>
                  <p className="text-xs text-slate-500">
                    {student.class?.name} · {student.studentId}
                  </p>
                  {wallet && (
                    <p className="text-sm">
                      Wallet{' '}
                      <b className={Number(wallet.wallet.balance) < total ? 'text-red-700' : 'text-emerald-700'}>
                        {money(wallet.wallet.balance, cur)}
                      </b>
                      {wallet.wallet.dailyLimit && (
                        <span className="text-xs text-slate-500">
                          {' '}
                          · limit {money(wallet.wallet.dailyLimit, cur)}/day, spent {money(wallet.spentToday, cur)}
                        </span>
                      )}
                    </p>
                  )}
                </div>
                <Button variant="ghost" onClick={() => setStudent(null)}>
                  Change
                </Button>
              </div>
            ) : (
              <>
                <SearchBox value={search} onChange={setSearch} placeholder="Search student…" />
                {results?.items?.length > 0 && (
                  <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200">
                    {results.items.map((s: any) => (
                      <li key={s.id}>
                        <button
                          className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                          onClick={() => {
                            setStudent(s);
                            setSearch('');
                          }}
                        >
                          {s.firstName} {s.lastName} <span className="text-slate-500">· {s.class?.name}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-2 flex gap-2">
                  <Input
                    value={qr}
                    onChange={(e) => setQr(e.target.value)}
                    placeholder="or scan ID card QR"
                    onKeyDown={(e) => e.key === 'Enter' && scan()}
                  />
                  <Button variant="secondary" onClick={scan}>
                    <ScanLine size={16} />
                  </Button>
                </div>
              </>
            )}
          </Card>
          <Card title="Cart" padded={false}>
            <ul className="divide-y divide-slate-100 text-sm">
              {Object.entries(cart).map(([id, n]) => {
                const i = items?.find((x) => x.id === id);
                if (!i) return null;
                return (
                  <li key={id} className="flex items-center gap-2 px-3 py-2">
                    <span className="flex-1">{i.name}</span>
                    <button onClick={() => add(id, -1)} className="rounded-md bg-slate-100 p-1">
                      <Minus size={12} />
                    </button>
                    <span className="w-6 text-center">{n}</span>
                    <button onClick={() => add(id, 1)} className="rounded-md bg-slate-100 p-1">
                      <Plus size={12} />
                    </button>
                    <span className="w-20 text-right">{money(n * Number(i.price), cur)}</span>
                    <button
                      onClick={() =>
                        setCart((c) => {
                          const x = { ...c };
                          delete x[id];
                          return x;
                        })
                      }
                      className="text-slate-400"
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                );
              })}
              {!Object.keys(cart).length && (
                <li className="px-3 py-6 text-center text-slate-500">Tap items to add them</li>
              )}
            </ul>
            <div className="border-t border-slate-100 p-3">
              <div className="mb-3 flex justify-between text-lg font-semibold">
                <span>Total</span>
                <span>{money(total, cur)}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={() => charge('WALLET')} disabled={!student || total <= 0} loading={busy}>
                  Charge wallet
                </Button>
                <Button variant="secondary" onClick={() => charge('CASH')} disabled={total <= 0} loading={busy}>
                  Cash
                </Button>
              </div>
            </div>
          </Card>
          {last && (
            <Alert kind="success">
              Sale recorded: {money(last.total, cur)} ({last.mode.toLowerCase()})
              {last.balanceAfter !== null && last.balanceAfter !== undefined
                ? ` · wallet balance now ${money(last.balanceAfter, cur)}`
                : ''}
            </Alert>
          )}
        </div>
      </div>
    </div>
  );
}
