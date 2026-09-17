'use client';
import Link from 'next/link';
import { useState } from 'react';
import { api, qs } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { fmtDate, money } from '@/lib/format';
import { Badge, DataTable, PageHeader, Select, useToast } from '@/components/ui';

export default function SubscriptionInvoices() {
  const toast = useToast();
  const [status, setStatus] = useState('PENDING');
  const { data, loading, reload } = useApi<any[]>(`/platform/subscription-invoices${qs({ status, pageSize: 100 })}`, [
    status,
  ]);
  const markPaid = async (i: any) => {
    const reference = prompt(`Payment reference for ${i.number}`) ?? '';
    try {
      await api.post(`/platform/subscription-invoices/${i.id}/mark-paid`, { reference });
      toast.success('Marked paid');
      reload();
    } catch (e: any) {
      toast.error(e.message);
    }
  };
  return (
    <div>
      <PageHeader
        title="Subscription invoices"
        subtitle="Confirm bank / Mobile Money payments to activate or upgrade schools"
      />
      <div className="mb-4 w-48">
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          placeholder="All"
          options={['PENDING', 'PAID', 'OVERDUE', 'CANCELLED'].map((s) => ({ value: s, label: s }))}
        />
      </div>
      <DataTable
        rows={data}
        loading={loading}
        columns={[
          { key: 'number', header: 'Invoice', render: (i: any) => <span className="font-medium">{i.number}</span> },
          {
            key: 'school',
            header: 'School',
            render: (i: any) => (
              <Link href={`/platform/schools/${i.tenantId}`} className="text-brand hover:underline">
                {i.subscription.tenant.name}
              </Link>
            ),
          },
          { key: 'description', header: 'Description' },
          { key: 'amount', header: 'Amount', align: 'right', render: (i: any) => money(i.amount, i.currency) },
          { key: 'dueDate', header: 'Due', render: (i: any) => fmtDate(i.dueDate) },
          { key: 'status', header: 'Status', render: (i: any) => <Badge>{i.status}</Badge> },
          {
            key: 'x',
            header: '',
            render: (i: any) =>
              i.status === 'PENDING' && (
                <button className="text-xs text-brand hover:underline" onClick={() => markPaid(i)}>
                  Mark paid
                </button>
              ),
          },
        ]}
      />
    </div>
  );
}
