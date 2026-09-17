'use client';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { FileDown, Printer } from 'lucide-react';
import { api, openBlob } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { fmtDate, fmtDateTime, money, title } from '@/lib/format';
import { Badge, Button, Card, PageHeader, Spinner, useToast } from '@/components/ui';

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { me, can } = useAuth();
  const { data: inv, loading, reload } = useApi(`/fees/invoices/${id}`);
  if (loading || !inv) return <Spinner />;
  const cur = me?.tenant?.currency ?? 'GHS';
  const cancel = async () => {
    const reason = prompt('Reason for cancelling this invoice');
    if (!reason) return;
    try {
      await api.post(`/fees/invoices/${id}/cancel`, { reason });
      toast.success('Invoice cancelled');
      reload();
    } catch (e: any) {
      toast.error(e.message);
    }
  };
  const g = inv.student.guardians?.[0]?.guardian;
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        back={() => router.back()}
        title={
          <>
            Invoice {inv.number} <Badge>{inv.status}</Badge>
          </>
        }
        subtitle={`${inv.term?.name} ${inv.academicYear?.name} · issued ${fmtDate(inv.issuedAt)} · due ${fmtDate(inv.dueDate)}`}
        actions={
          <>
            <Button variant="secondary" onClick={() => openBlob(`/documents/invoices/${id}.pdf`)}>
              <FileDown size={16} /> Invoice PDF
            </Button>
            <Button variant="secondary" onClick={() => window.print()}>
              <Printer size={16} /> Print
            </Button>
            {can('PAYMENT_RECORD') && Number(inv.balance) > 0 && inv.status !== 'CANCELLED' && (
              <Link
                href={`/school/fees/payments/new?studentId=${inv.student.id}&invoiceId=${inv.id}`}
                className="btn-primary"
              >
                Record payment
              </Link>
            )}
            {can('FEES_MANAGE') && inv.status !== 'CANCELLED' && Number(inv.paidTotal) === 0 && (
              <Button variant="danger" onClick={cancel}>
                Cancel invoice
              </Button>
            )}
          </>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Card title="Bill to">
          <p className="font-medium">
            {inv.student.firstName} {inv.student.lastName}
          </p>
          <p className="text-sm text-slate-600">
            {inv.student.studentId} · {inv.student.class?.name}
          </p>
          {g && (
            <p className="mt-2 text-sm text-slate-600">
              Guardian: {g.firstName} {g.lastName} · {g.phone}
              {g.email ? ` · ${g.email}` : ''}
            </p>
          )}
        </Card>
        <Card title="Summary">
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{money(inv.subtotal, cur)}</span>
            </div>
            <div className="flex justify-between text-emerald-700">
              <span>Discounts</span>
              <span>− {money(inv.discountTotal, cur)}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span>Total</span>
              <span>{money(inv.total, cur)}</span>
            </div>
            <div className="flex justify-between">
              <span>Paid</span>
              <span>{money(inv.paidTotal, cur)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold">
              <span>Balance</span>
              <span className={Number(inv.balance) > 0 ? 'text-red-700' : 'text-emerald-700'}>
                {money(inv.balance, cur)}
              </span>
            </div>
          </div>
        </Card>
      </div>
      <Card title="Fee lines" className="mt-4" padded={false}>
        <table className="table">
          <thead>
            <tr>
              <th>Fee</th>
              <th className="text-right">Amount</th>
              <th className="text-right">Discount</th>
              <th className="text-right">Net</th>
            </tr>
          </thead>
          <tbody>
            {inv.lines.map((l: any) => (
              <tr key={l.id}>
                <td>{l.description}</td>
                <td className="text-right">{money(l.amount, cur)}</td>
                <td className="text-right">{Number(l.discount) ? money(l.discount, cur) : '—'}</td>
                <td className="text-right font-medium">{money(Number(l.amount) - Number(l.discount), cur)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Card title="Installment plan" padded={false}>
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Due</th>
                <th className="text-right">Amount</th>
                <th className="text-right">Paid</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {inv.installments.map((i: any) => (
                <tr key={i.id}>
                  <td>{i.sequence}</td>
                  <td>{fmtDate(i.dueDate)}</td>
                  <td className="text-right">{money(i.amount, cur)}</td>
                  <td className="text-right">{money(i.paidAmount, cur)}</td>
                  <td>
                    <Badge>{i.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card title="Payments" padded={false}>
          <table className="table">
            <thead>
              <tr>
                <th>Receipt</th>
                <th>Date</th>
                <th>Method</th>
                <th className="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {inv.payments.map((p: any) => (
                <tr key={p.id} className={p.status === 'REVERSED' ? 'line-through text-slate-400' : ''}>
                  <td>
                    <Link href={`/school/fees/payments/${p.id}`} className="text-brand hover:underline">
                      {p.receiptNumber}
                    </Link>
                  </td>
                  <td>{fmtDateTime(p.paidAt)}</td>
                  <td>{title(p.method)}</td>
                  <td className="text-right">{money(p.amount, cur)}</td>
                </tr>
              ))}
              {!inv.payments.length && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-slate-500">
                    No payments yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
