'use client';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { FileDown } from 'lucide-react';
import { api, openBlob } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { fmtDateTime, money, title } from '@/lib/format';
import { Badge, Button, Card, Description, PageHeader, Spinner, useToast } from '@/components/ui';

export default function PaymentDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { me, can } = useAuth();
  const { data: p, loading, reload } = useApi(`/fees/payments/${id}`);
  if (loading || !p) return <Spinner />;
  const cur = me?.tenant?.currency ?? 'GHS';
  const reverse = async () => {
    const reason = prompt('Reason for reversing this payment');
    if (!reason) return;
    try {
      await api.post(`/fees/payments/${id}/reverse`, { reason });
      toast.success('Payment reversed');
      reload();
    } catch (e: any) {
      toast.error(e.message);
    }
  };
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        back={() => router.back()}
        title={
          <>
            Receipt {p.receiptNumber ?? '—'} <Badge>{p.status}</Badge>
          </>
        }
        subtitle={`${money(p.amount, cur)} · ${title(p.method)} · ${fmtDateTime(p.paidAt)}`}
        actions={
          <>
            {p.status === 'SUCCESS' && (
              <Button variant="secondary" onClick={() => openBlob(`/fees/payments/${id}/receipt.pdf`)}>
                <FileDown size={16} /> Receipt PDF
              </Button>
            )}
            {can('REFUND_APPROVE') && p.status === 'SUCCESS' && (
              <Button variant="danger" onClick={reverse}>
                Reverse
              </Button>
            )}
          </>
        }
      />
      <Card>
        <Description
          items={[
            [
              'Student',
              <Link key="s" href={`/school/students/${p.student.id}`} className="text-brand hover:underline">
                {p.student.firstName} {p.student.lastName} ({p.student.studentId})
              </Link>,
            ],
            ['Class', p.student.class?.name],
            [
              'Invoice',
              p.invoice ? (
                <Link key="i" href={`/school/fees/invoices/${p.invoice.id}`} className="text-brand hover:underline">
                  {p.invoice.number} ({title(p.invoice.status)})
                </Link>
              ) : p.purpose === 'WALLET' ? (
                'Canteen wallet top-up'
              ) : (
                'Unallocated credit'
              ),
            ],
            ['Reference', p.reference ?? p.providerRef],
            ['Provider', p.provider],
            ['Recorded by', p.recordedByName],
            ['Payer email', p.payerEmail],
            ['Notes', p.notes],
            ['Account balance after', money(p.student.account?.balance ?? 0, cur)],
            ...(p.status === 'REVERSED'
              ? [['Reversed', `${fmtDateTime(p.reversedAt)}: ${p.reversalReason}`] as [string, any]]
              : []),
          ]}
        />
      </Card>
    </div>
  );
}
