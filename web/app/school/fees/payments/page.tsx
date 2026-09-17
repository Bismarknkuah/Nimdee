'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Download, Plus } from 'lucide-react';
import { downloadBlob, qs } from '@/lib/api';
import { useApi, useDebounce } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { fmtDateTime, money, title } from '@/lib/format';
import { Badge, DataTable, Field, Input, PageHeader, SearchBox, Select } from '@/components/ui';

export default function PaymentsPage() {
  const router = useRouter();
  const { me, can } = useAuth();
  const cur = me?.tenant?.currency ?? 'GHS';
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [method, setMethod] = useState('');
  const [status, setStatus] = useState('SUCCESS');
  const [page, setPage] = useState(1);
  const q = useDebounce(search);
  const { data, loading } = useApi(`/fees/payments${qs({ search: q, from, to, method, status, page, pageSize: 25 })}`);
  return (
    <div>
      <PageHeader
        title="Payments"
        subtitle={data ? `${data.total} payments · ${money(data.sumAmount, cur)}` : undefined}
        actions={
          <>
            {can('EXPORT_DATA') && (
              <button
                className="btn-secondary"
                onClick={() => downloadBlob(`/exports/payments.csv${qs({ from, to })}`, 'payments.csv')}
              >
                <Download size={16} /> Export
              </button>
            )}
            {can('PAYMENT_RECORD') && (
              <Link href="/school/fees/payments/new" className="btn-primary">
                <Plus size={16} /> Record payment
              </Link>
            )}
          </>
        }
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-5">
        <Field label="Search" className="sm:col-span-2">
          <SearchBox
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="Receipt, reference or student"
          />
        </Field>
        <Field label="From">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="To">
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
        <Field label="Method">
          <Select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            placeholder="All"
            options={['CASH', 'MOBILE_MONEY', 'CARD', 'BANK_TRANSFER', 'CHEQUE', 'ONLINE'].map((m) => ({
              value: m,
              label: title(m),
            }))}
          />
        </Field>
      </div>
      <div className="mb-3 flex gap-2">
        {['SUCCESS', 'REVERSED', 'PENDING', 'FAILED'].map((s) => (
          <button
            key={s}
            onClick={() => {
              setStatus(s);
              setPage(1);
            }}
            className={`rounded-full px-3 py-1 text-xs font-medium ${status === s ? 'bg-brand text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}
          >
            {title(s)}
          </button>
        ))}
      </div>
      <DataTable
        rows={data?.items}
        loading={loading}
        page={page}
        pageSize={25}
        total={data?.total}
        onPage={setPage}
        onRowClick={(r: any) => router.push(`/school/fees/payments/${r.id}`)}
        columns={[
          {
            key: 'receiptNumber',
            header: 'Receipt',
            render: (p: any) => <span className="font-medium text-brand">{p.receiptNumber ?? '—'}</span>,
          },
          { key: 'paidAt', header: 'Date', render: (p: any) => fmtDateTime(p.paidAt) },
          { key: 'student', header: 'Student', render: (p: any) => `${p.student.firstName} ${p.student.lastName}` },
          {
            key: 'invoice',
            header: 'Invoice',
            render: (p: any) => p.invoice?.number ?? (p.purpose === 'WALLET' ? 'Wallet top-up' : 'Unallocated'),
          },
          { key: 'method', header: 'Method', render: (p: any) => title(p.method) },
          { key: 'reference', header: 'Reference', render: (p: any) => p.reference ?? '—' },
          { key: 'amount', header: 'Amount', align: 'right', render: (p: any) => money(p.amount, cur) },
          { key: 'status', header: 'Status', render: (p: any) => <Badge>{p.status}</Badge> },
        ]}
      />
    </div>
  );
}
