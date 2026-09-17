'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { api, qs } from '@/lib/api';
import { useApi, useDebounce } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { fmtDate, money, title } from '@/lib/format';
import { Badge, Button, Card, Field, Input, PageHeader, SearchBox, Select, Textarea, useToast } from '@/components/ui';

function RecordPayment() {
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const { me } = useAuth();
  const cur = me?.tenant?.currency ?? 'GHS';
  const [search, setSearch] = useState('');
  const q = useDebounce(search);
  const [studentId, setStudentId] = useState(params.get('studentId') ?? '');
  const { data: results } = useApi(q.length >= 2 ? `/students${qs({ search: q, pageSize: 8 })}` : null, [q]);
  const { data: statement } = useApi(studentId ? `/fees/students/${studentId}/statement` : null, [studentId]);
  const [f, setF] = useState<any>({
    invoiceId: params.get('invoiceId') ?? '',
    amount: '',
    method: 'CASH',
    reference: '',
    paidAt: '',
    notes: '',
    payerEmail: '',
  });
  const [busy, setBusy] = useState(false);
  const openInvoices = (statement?.invoices ?? []).filter((i: any) =>
    ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'].includes(i.status),
  );
  useEffect(() => {
    if (openInvoices.length && !f.invoiceId) setF((x: any) => ({ ...x, invoiceId: openInvoices[0].id }));
  }, [openInvoices, f.invoiceId]);
  const inv = openInvoices.find((i: any) => i.id === f.invoiceId);
  const submit = async () => {
    setBusy(true);
    try {
      const p = await api.post('/fees/payments', {
        studentId,
        invoiceId: f.invoiceId || undefined,
        amount: Number(f.amount),
        method: f.method,
        reference: f.reference || undefined,
        paidAt: f.paidAt ? new Date(f.paidAt).toISOString() : undefined,
        notes: f.notes || undefined,
        payerEmail: f.payerEmail || undefined,
      });
      toast.success(`Receipt ${p.receiptNumber} issued`);
      router.replace(`/school/fees/payments/${p.id}`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        back={() => router.back()}
        title="Record a payment"
        subtitle="Cash, Mobile Money, bank or cheque payments received at the school"
      />
      <Card title="1. Student" className="mb-4">
        {!studentId ? (
          <>
            <SearchBox value={search} onChange={setSearch} placeholder="Type a name or student ID…" />
            {results?.items?.length > 0 && (
              <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200">
                {results.items.map((s: any) => (
                  <li key={s.id}>
                    <button
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50"
                      onClick={() => setStudentId(s.id)}
                    >
                      <span>
                        {s.firstName} {s.lastName}{' '}
                        <span className="text-slate-500">
                          {s.studentId} · {s.class?.name}
                        </span>
                      </span>
                      <span className={Number(s.balance) > 0 ? 'text-red-700' : 'text-slate-500'}>
                        {money(s.balance, cur)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : statement ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">
                {statement.student.firstName} {statement.student.lastName}
              </p>
              <p className="text-sm text-slate-500">
                {statement.student.studentId} · {statement.student.class?.name} · balance{' '}
                <b className={Number(statement.balance) > 0 ? 'text-red-700' : ''}>{money(statement.balance, cur)}</b>
              </p>
            </div>
            <Button
              variant="ghost"
              onClick={() => {
                setStudentId('');
                setF({ ...f, invoiceId: '' });
              }}
            >
              Change
            </Button>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Loading…</p>
        )}
      </Card>
      {studentId && statement && (
        <Card title="2. Payment details">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Apply to invoice" className="sm:col-span-2">
              <Select
                value={f.invoiceId}
                onChange={(e) => setF({ ...f, invoiceId: e.target.value })}
                placeholder="Unallocated credit (oldest open invoice is used)"
                options={openInvoices.map((i: any) => ({
                  value: i.id,
                  label: `${i.number} · ${i.term?.name} · balance ${money(i.balance, cur)}`,
                }))}
              />
            </Field>
            {inv && (
              <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600 sm:col-span-2">
                <Badge>{inv.status}</Badge> due {fmtDate(inv.dueDate)} · next installment{' '}
                {inv.installments.find((x: any) => x.status !== 'PAID')
                  ? money(inv.installments.find((x: any) => x.status !== 'PAID').amount, cur)
                  : '—'}{' '}
                <button
                  className="ml-2 text-brand underline"
                  onClick={() => setF({ ...f, amount: String(Number(inv.balance)) })}
                >
                  Pay full balance
                </button>
              </div>
            )}
            <Field label={`Amount (${cur})`}>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={f.amount}
                onChange={(e) => setF({ ...f, amount: e.target.value })}
              />
            </Field>
            <Field label="Method">
              <Select
                value={f.method}
                onChange={(e) => setF({ ...f, method: e.target.value })}
                options={['CASH', 'MOBILE_MONEY', 'CARD', 'BANK_TRANSFER', 'CHEQUE'].map((m) => ({
                  value: m,
                  label: title(m),
                }))}
              />
            </Field>
            <Field label="Reference" hint="MoMo transaction ID, cheque no., bank ref">
              <Input value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} />
            </Field>
            <Field label="Payment date" hint="Leave blank for now">
              <Input type="datetime-local" value={f.paidAt} onChange={(e) => setF({ ...f, paidAt: e.target.value })} />
            </Field>
            <Field label="Payer email (for receipt)">
              <Input type="email" value={f.payerEmail} onChange={(e) => setF({ ...f, payerEmail: e.target.value })} />
            </Field>
            <Field label="Notes" className="sm:col-span-2">
              <Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
            </Field>
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={submit} loading={busy} disabled={!f.amount || Number(f.amount) <= 0}>
              Record payment & issue receipt
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
export default function NewPaymentPage() {
  return (
    <Suspense>
      <RecordPayment />
    </Suspense>
  );
}
