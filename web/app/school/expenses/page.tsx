'use client';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { api, qs } from '@/lib/api';
import { useApi, useDebounce } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { fmtDate, money, title, todayIso } from '@/lib/format';
import {
  Badge,
  Button,
  Card,
  DataTable,
  Field,
  ImageUpload,
  Input,
  KeyStat,
  Modal,
  PageHeader,
  SearchBox,
  Select,
  Textarea,
  useToast,
} from '@/components/ui';

const CATEGORIES = [
  'Supplies',
  'Maintenance & Repairs',
  'Utilities',
  'Transport & Fuel',
  'Stationery & Printing',
  'Equipment',
  'Furniture',
  'Cleaning',
  'Events & Functions',
  'Other',
];

function RecordExpenseModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [f, setF] = useState<any>({
    category: '',
    description: '',
    amount: '',
    vendor: '',
    purchasedAt: todayIso(),
    receiptUrl: '',
    notes: '',
  });
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  const submit = async () => {
    if (!f.category || !f.description || !f.amount) return toast.error('Category, description and amount are required');
    setBusy(true);
    try {
      const body = { ...f, amount: Number(f.amount) };
      if (!body.vendor) delete body.vendor;
      if (!body.receiptUrl) delete body.receiptUrl;
      if (!body.notes) delete body.notes;
      await api.post('/expenses', body);
      toast.success('Expense recorded, waiting on Finance Officer approval');
      onDone();
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title="Record an expense"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy}>
            Submit for approval
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Category">
          <Select
            value={f.category}
            onChange={set('category')}
            placeholder="Choose a category"
            options={CATEGORIES.map((c) => ({ value: c, label: c }))}
          />
        </Field>
        <Field label="Amount">
          <Input type="number" min="0.01" step="0.01" value={f.amount} onChange={set('amount')} />
        </Field>
        <Field label="Description" className="sm:col-span-2">
          <Input value={f.description} onChange={set('description')} placeholder="What was bought and why" />
        </Field>
        <Field label="Vendor / paid to">
          <Input value={f.vendor} onChange={set('vendor')} placeholder="Optional" />
        </Field>
        <Field label="Date of purchase">
          <Input type="date" value={f.purchasedAt} onChange={set('purchasedAt')} />
        </Field>
        <Field label="Receipt" className="sm:col-span-2">
          <ImageUpload value={f.receiptUrl} onChange={(dataUrl) => setF({ ...f, receiptUrl: dataUrl })} shape="square" />
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <Textarea value={f.notes} onChange={set('notes')} placeholder="Optional" />
        </Field>
      </div>
    </Modal>
  );
}

function RejectModal({ expense, onClose, onDone }: { expense: any; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!reason.trim()) return toast.error('Give a reason so the Headmaster knows what to fix');
    setBusy(true);
    try {
      await api.post(`/expenses/${expense.id}/reject`, { reason });
      toast.success('Expense rejected');
      onDone();
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title="Reject expense"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" onClick={submit} loading={busy}>
            Reject
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm text-slate-600">
        {expense.description} — {money(expense.amount)}
      </p>
      <Field label="Reason">
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why this can't be approved as submitted" />
      </Field>
    </Modal>
  );
}

export default function ExpensesPage() {
  const { can } = useAuth();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [recording, setRecording] = useState(false);
  const [rejecting, setRejecting] = useState<any>(null);
  const q = useDebounce(search);
  const { data, loading, reload } = useApi<any>(`/expenses${qs({ search: q, status, page, pageSize: 25 })}`, [
    q,
    status,
    page,
  ]);
  const { data: summary, reload: reloadSummary } = useApi<any>('/expenses/summary');
  const canApprove = can('EXPENSE_APPROVE');
  const canCreate = can('EXPENSE_CREATE');
  const approve = async (id: string) => {
    try {
      await api.post(`/expenses/${id}/approve`);
      toast.success('Expense approved');
      reload();
      reloadSummary();
    } catch (e: any) {
      toast.error(e.message);
    }
  };
  return (
    <div>
      <PageHeader
        title="Expenses"
        subtitle="Purchases recorded by the Headmaster, approved by the Finance Officer"
        actions={
          canCreate && (
            <Button onClick={() => setRecording(true)}>
              <Plus size={16} /> Record expense
            </Button>
          )
        }
      />
      {summary && (
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <KeyStat label="Awaiting approval" value={`${summary.pending.count}`} sub={money(summary.pending.total)} />
          <KeyStat label="Approved" value={`${summary.approved.count}`} sub={money(summary.approved.total)} />
          <KeyStat label="Rejected" value={`${summary.rejected.count}`} sub={money(summary.rejected.total)} />
        </div>
      )}
      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <SearchBox
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="Description, category or vendor"
          />
        </div>
        <Select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          placeholder="All statuses"
          options={['PENDING', 'APPROVED', 'REJECTED'].map((s) => ({ value: s, label: title(s) }))}
        />
      </div>
      <Card padded={false}>
        <DataTable
          rows={data?.items}
          loading={loading}
          page={page}
          pageSize={25}
          total={data?.total}
          onPage={setPage}
          columns={[
            { key: 'purchasedAt', header: 'Date', render: (e: any) => fmtDate(e.purchasedAt) },
            {
              key: 'description',
              header: 'Expense',
              render: (e: any) => (
                <div>
                  <p className="font-medium text-slate-900">{e.description}</p>
                  <p className="text-xs text-slate-500">
                    {e.category}
                    {e.vendor ? ` · ${e.vendor}` : ''}
                  </p>
                </div>
              ),
            },
            { key: 'amount', header: 'Amount', align: 'right', render: (e: any) => money(e.amount) },
            { key: 'requestedByName', header: 'Recorded by', render: (e: any) => e.requestedByName ?? '—' },
            { key: 'status', header: 'Status', render: (e: any) => <Badge>{e.status}</Badge> },
            {
              key: 'actions',
              header: '',
              render: (e: any) =>
                e.status === 'PENDING' && canApprove ? (
                  <div className="flex justify-end gap-2">
                    <button className="text-xs text-red-600 hover:underline" onClick={() => setRejecting(e)}>
                      Reject
                    </button>
                    <button className="text-xs text-brand hover:underline" onClick={() => approve(e.id)}>
                      Approve
                    </button>
                  </div>
                ) : e.status === 'REJECTED' && e.rejectionReason ? (
                  <span className="text-xs text-slate-400" title={e.rejectionReason}>
                    Why?
                  </span>
                ) : e.approvedByName ? (
                  <span className="text-xs text-slate-400">by {e.approvedByName}</span>
                ) : null,
            },
          ]}
        />
      </Card>
      {recording && (
        <RecordExpenseModal
          onClose={() => setRecording(false)}
          onDone={() => {
            reload();
            reloadSummary();
          }}
        />
      )}
      {rejecting && (
        <RejectModal
          expense={rejecting}
          onClose={() => setRejecting(null)}
          onDone={() => {
            reload();
            reloadSummary();
          }}
        />
      )}
    </div>
  );
}
