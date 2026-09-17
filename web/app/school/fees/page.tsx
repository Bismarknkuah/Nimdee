'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { Download, FilePlus, Plus } from 'lucide-react';
import { api, downloadBlob, qs } from '@/lib/api';
import { useAcademic, classOptions } from '@/lib/academic';
import { useApi, useDebounce } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { fmtDate, money, title } from '@/lib/format';
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  DataTable,
  Field,
  Input,
  Modal,
  PageHeader,
  SearchBox,
  Select,
  Tabs,
  useToast,
} from '@/components/ui';

function InvoicesTab({ cur }: { cur: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const { can } = useAuth();
  const { term, terms, classes } = useAcademic();
  const [termId, setTermId] = useState('');
  const [classId, setClassId] = useState('');
  const [status, setStatus] = useState(params.get('status') ?? '');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [gen, setGen] = useState(false);
  const [genOpts, setGenOpts] = useState<any>({ classId: '', dueDate: '', regenerate: false });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (term && !termId) setTermId(term.id);
  }, [term, termId]);
  const q = useDebounce(search);
  const { data, loading, reload } = useApi(
    termId ? `/fees/invoices${qs({ termId, classId, status, search: q, page, pageSize: 25 })}` : null,
    [termId, classId, status, q, page],
  );
  const summary = useApi(termId ? `/fees/summary${qs({ termId })}` : null, [termId]);
  const generate = async () => {
    setBusy(true);
    try {
      const r = await api.post('/fees/invoices/generate', {
        termId,
        classId: genOpts.classId || undefined,
        dueDate: genOpts.dueDate || undefined,
        regenerate: genOpts.regenerate,
      });
      toast.success(
        `${r.created} created, ${r.regenerated} regenerated, ${r.skipped} skipped${r.errors.length ? `, ${r.errors.length} errors` : ''}`,
      );
      if (r.errors.length) alert(r.errors.join('\n'));
      setGen(false);
      reload();
      summary.reload();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  const s = summary.data;
  return (
    <div>
      {s && (
        <div className="mb-4 grid gap-3 sm:grid-cols-4">
          <div className="card p-3">
            <p className="text-xs text-slate-500">Invoiced</p>
            <p className="text-lg font-semibold">{money(s.invoiced, cur)}</p>
          </div>
          <div className="card p-3">
            <p className="text-xs text-slate-500">Collected</p>
            <p className="text-lg font-semibold text-emerald-700">
              {money(s.collected, cur)}{' '}
              <span className="text-xs font-normal text-slate-500">({s.collectionRate}%)</span>
            </p>
          </div>
          <div className="card p-3">
            <p className="text-xs text-slate-500">Outstanding</p>
            <p className="text-lg font-semibold text-amber-700">{money(s.outstanding, cur)}</p>
          </div>
          <div className="card p-3">
            <p className="text-xs text-slate-500">Overdue invoices</p>
            <p className="text-lg font-semibold text-red-700">{s.overdueCount}</p>
          </div>
        </div>
      )}
      <div className="mb-4 grid gap-3 sm:grid-cols-5">
        <Field label="Term">
          <Select
            value={termId}
            onChange={(e) => setTermId(e.target.value)}
            options={terms.map((t: any) => ({ value: t.id, label: t.name }))}
          />
        </Field>
        <Field label="Class">
          <Select
            value={classId}
            onChange={(e) => {
              setClassId(e.target.value);
              setPage(1);
            }}
            placeholder="All classes"
            options={classOptions(classes)}
          />
        </Field>
        <Field label="Status">
          <Select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            placeholder="All"
            options={['ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED'].map((v) => ({
              value: v,
              label: title(v),
            }))}
          />
        </Field>
        <Field label="Search" className="sm:col-span-2">
          <SearchBox
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="Invoice no. or student"
          />
        </Field>
      </div>
      <div className="mb-3 flex justify-end gap-2">
        {can('EXPORT_DATA') && (
          <Button
            variant="secondary"
            onClick={() => downloadBlob(`/exports/invoices.csv${qs({ termId })}`, 'invoices.csv')}
          >
            <Download size={16} /> Export
          </Button>
        )}
        {can('INVOICE_CREATE') && (
          <Button onClick={() => setGen(true)}>
            <FilePlus size={16} /> Generate invoices
          </Button>
        )}
      </div>
      <DataTable
        rows={data?.items}
        loading={loading}
        page={page}
        pageSize={25}
        total={data?.total}
        onPage={setPage}
        onRowClick={(r: any) => router.push(`/school/fees/invoices/${r.id}`)}
        emptyTitle="No invoices for this term"
        emptyDescription="Generate invoices from your fee structures."
        columns={[
          {
            key: 'number',
            header: 'Invoice',
            render: (i: any) => <span className="font-medium text-brand">{i.number}</span>,
          },
          { key: 'student', header: 'Student', render: (i: any) => `${i.student.firstName} ${i.student.lastName}` },
          { key: 'class', header: 'Class', render: (i: any) => i.student.class?.name ?? '—' },
          { key: 'total', header: 'Total', align: 'right', render: (i: any) => money(i.total, cur) },
          { key: 'paidTotal', header: 'Paid', align: 'right', render: (i: any) => money(i.paidTotal, cur) },
          {
            key: 'balance',
            header: 'Balance',
            align: 'right',
            render: (i: any) => (
              <span className={Number(i.balance) > 0 ? 'font-medium text-red-700' : ''}>{money(i.balance, cur)}</span>
            ),
          },
          { key: 'dueDate', header: 'Due', render: (i: any) => fmtDate(i.dueDate) },
          { key: 'status', header: 'Status', render: (i: any) => <Badge>{i.status}</Badge> },
        ]}
      />
      <Modal
        open={gen}
        onClose={() => setGen(false)}
        title="Generate invoices"
        footer={
          <>
            <Button variant="secondary" onClick={() => setGen(false)}>
              Cancel
            </Button>
            <Button onClick={generate} loading={busy}>
              Generate
            </Button>
          </>
        }
      >
        <Alert kind="info" className="mb-3">
          Invoices are built from the fee structures for the term&apos;s academic year (class-specific structures
          override level structures). Discounts, sibling discounts and installments follow your rules.
        </Alert>
        <div className="grid gap-3">
          <Field label="Class">
            <Select
              value={genOpts.classId}
              onChange={(e) => setGenOpts({ ...genOpts, classId: e.target.value })}
              placeholder="All classes"
              options={classOptions(classes)}
            />
          </Field>
          <Field label="Due date" hint="Defaults to term start + grace days">
            <Input
              type="date"
              value={genOpts.dueDate}
              onChange={(e) => setGenOpts({ ...genOpts, dueDate: e.target.value })}
            />
          </Field>
          <Checkbox
            label="Regenerate existing unpaid invoices (invoices with payments are never touched)"
            checked={genOpts.regenerate}
            onChange={(e) => setGenOpts({ ...genOpts, regenerate: e.target.checked })}
          />
        </div>
      </Modal>
    </div>
  );
}

function StructuresTab({ cur }: { cur: string }) {
  const toast = useToast();
  const { can } = useAuth();
  const { year, classes } = useAcademic();
  const years = useApi<any[]>('/academic/years');
  const cats = useApi<any[]>('/fees/categories');
  const [yearId, setYearId] = useState('');
  useEffect(() => {
    if (year && !yearId) setYearId(year.id);
  }, [year, yearId]);
  const { data, loading, reload } = useApi(yearId ? `/fees/structures${qs({ academicYearId: yearId })}` : null, [
    yearId,
  ]);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<any>({ categoryId: '', level: '', classId: '', termId: '', amount: '', appliesTo: 'ALL' });
  const [busy, setBusy] = useState(false);
  const levels = Array.from(new Set(classes.map((c) => c.level)));
  const save = async () => {
    setBusy(true);
    try {
      await api.post('/fees/structures', {
        academicYearId: yearId,
        categoryId: f.categoryId,
        level: f.level || undefined,
        classId: f.classId || undefined,
        termId: f.termId || undefined,
        amount: Number(f.amount),
        appliesTo: f.appliesTo,
      });
      toast.success('Fee structure added');
      setOpen(false);
      reload();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  const yr = years.data?.find((y) => y.id === yearId);
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Field label="Academic year">
          <Select
            value={yearId}
            onChange={(e) => setYearId(e.target.value)}
            options={(years.data ?? []).map((y) => ({ value: y.id, label: y.name }))}
          />
        </Field>
        <div className="ml-auto">
          {can('FEES_MANAGE') && (
            <Button onClick={() => setOpen(true)}>
              <Plus size={16} /> Add fee
            </Button>
          )}
        </div>
      </div>
      <DataTable
        rows={data}
        loading={loading}
        emptyTitle="No fee structures"
        emptyDescription="Add the fees charged per level or class."
        columns={[
          { key: 'category', header: 'Fee', render: (s: any) => s.category.name },
          {
            key: 'scope',
            header: 'Applies to',
            render: (s: any) =>
              s.classId ? (classes.find((c) => c.id === s.classId)?.name ?? 'Class') : `All ${s.level} classes`,
          },
          {
            key: 'term',
            header: 'Term',
            render: (s: any) =>
              s.termId ? (yr?.terms.find((t: any) => t.id === s.termId)?.name ?? 'Term') : 'Every term',
          },
          { key: 'appliesTo', header: 'Students', render: (s: any) => title(s.appliesTo) },
          { key: 'amount', header: 'Amount', align: 'right', render: (s: any) => money(s.amount, cur) },
          {
            key: 'x',
            header: '',
            render: (s: any) =>
              can('FEES_MANAGE') && (
                <button
                  className="text-xs text-red-600 hover:underline"
                  onClick={async () => {
                    if (!confirm('Delete this fee structure?')) return;
                    try {
                      await api.delete(`/fees/structures/${s.id}`);
                      reload();
                    } catch (e: any) {
                      toast.error(e.message);
                    }
                  }}
                >
                  Delete
                </button>
              ),
          },
        ]}
      />
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add fee structure"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} loading={busy} disabled={!f.categoryId || !f.amount || (!f.level && !f.classId)}>
              Save
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Fee category" className="sm:col-span-2">
            <Select
              value={f.categoryId}
              onChange={(e) => setF({ ...f, categoryId: e.target.value })}
              placeholder="Select"
              options={(cats.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
            />
          </Field>
          <Field label="Level">
            <Select
              value={f.level}
              onChange={(e) => setF({ ...f, level: e.target.value, classId: '' })}
              placeholder="—"
              options={levels.map((l) => ({ value: l, label: l }))}
            />
          </Field>
          <Field label="or specific class">
            <Select
              value={f.classId}
              onChange={(e) => setF({ ...f, classId: e.target.value, level: '' })}
              placeholder="—"
              options={classOptions(classes)}
            />
          </Field>
          <Field label="Term" hint="Leave blank to charge every term">
            <Select
              value={f.termId}
              onChange={(e) => setF({ ...f, termId: e.target.value })}
              placeholder="Every term"
              options={(yr?.terms ?? []).map((t: any) => ({ value: t.id, label: t.name }))}
            />
          </Field>
          <Field label="Applies to">
            <Select
              value={f.appliesTo}
              onChange={(e) => setF({ ...f, appliesTo: e.target.value })}
              options={[
                { value: 'ALL', label: 'All students' },
                { value: 'BOARDING', label: 'Boarding only' },
                { value: 'DAY', label: 'Day students only' },
              ]}
            />
          </Field>
          <Field label={`Amount (${cur})`}>
            <Input
              type="number"
              step="0.01"
              value={f.amount}
              onChange={(e) => setF({ ...f, amount: e.target.value })}
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
}

function CategoriesTab() {
  const toast = useToast();
  const { can } = useAuth();
  const { data, loading, reload } = useApi<any[]>('/fees/categories');
  const [name, setName] = useState('');
  return (
    <div>
      {can('FEES_MANAGE') && (
        <div className="mb-3 flex max-w-md gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="New category, e.g. Tuition" />
          <Button
            onClick={async () => {
              try {
                await api.post('/fees/categories', { name });
                setName('');
                reload();
              } catch (e: any) {
                toast.error(e.message);
              }
            }}
            disabled={!name}
          >
            Add
          </Button>
        </div>
      )}
      <DataTable
        rows={data}
        loading={loading}
        columns={[
          { key: 'name', header: 'Category' },
          {
            key: 'structures',
            header: 'Fee structures',
            align: 'right',
            render: (c: any) => c._count?.structures ?? 0,
          },
          {
            key: 'isActive',
            header: 'Status',
            render: (c: any) => <Badge>{c.isActive ? 'ACTIVE' : 'INACTIVE'}</Badge>,
          },
        ]}
      />
    </div>
  );
}

function DiscountsTab({ cur }: { cur: string }) {
  const toast = useToast();
  const { can } = useAuth();
  const { data, loading, reload } = useApi<any[]>('/fees/discounts');
  const students = useApi('/students?pageSize=500');
  const cats = useApi<any[]>('/fees/categories');
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<any>({ studentId: '', name: '', type: 'PERCENT', value: '', categoryId: '', reason: '' });
  const save = async () => {
    try {
      await api.post('/fees/discounts', {
        ...f,
        value: Number(f.value),
        categoryId: f.categoryId || undefined,
        reason: f.reason || undefined,
      });
      toast.success('Discount granted');
      setOpen(false);
      reload();
    } catch (e: any) {
      toast.error(e.message);
    }
  };
  const name = (id: string) => {
    const s = students.data?.items?.find((x: any) => x.id === id);
    return s ? `${s.firstName} ${s.lastName}` : id;
  };
  return (
    <div>
      {can('DISCOUNT_MANAGE') && (
        <div className="mb-3 flex justify-end">
          <Button onClick={() => setOpen(true)}>
            <Plus size={16} /> Grant discount
          </Button>
        </div>
      )}
      <DataTable
        rows={data}
        loading={loading}
        emptyTitle="No discounts"
        columns={[
          {
            key: 'student',
            header: 'Student',
            render: (d: any) => (
              <Link href={`/school/students/${d.studentId}`} className="hover:underline">
                {name(d.studentId)}
              </Link>
            ),
          },
          { key: 'name', header: 'Discount' },
          {
            key: 'value',
            header: 'Value',
            render: (d: any) => (d.type === 'PERCENT' ? `${Number(d.value)}%` : money(d.value, cur)),
          },
          {
            key: 'categoryId',
            header: 'Applies to',
            render: (d: any) => (d.categoryId ? cats.data?.find((c) => c.id === d.categoryId)?.name : 'All fees'),
          },
          { key: 'reason', header: 'Reason' },
          {
            key: 'x',
            header: '',
            render: (d: any) =>
              can('DISCOUNT_MANAGE') && (
                <button
                  className="text-xs text-red-600 hover:underline"
                  onClick={async () => {
                    if (!confirm('Remove discount?')) return;
                    await api.delete(`/fees/discounts/${d.id}`);
                    reload();
                  }}
                >
                  Remove
                </button>
              ),
          },
        ]}
      />
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Grant a discount"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={!f.studentId || !f.name || !f.value}>
              Grant
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Student" className="sm:col-span-2">
            <Select
              value={f.studentId}
              onChange={(e) => setF({ ...f, studentId: e.target.value })}
              placeholder="Select student"
              options={(students.data?.items ?? []).map((s: any) => ({
                value: s.id,
                label: `${s.firstName} ${s.lastName} (${s.studentId})`,
              }))}
            />
          </Field>
          <Field label="Name">
            <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Scholarship" />
          </Field>
          <Field label="Type">
            <Select
              value={f.type}
              onChange={(e) => setF({ ...f, type: e.target.value })}
              options={[
                { value: 'PERCENT', label: 'Percentage' },
                { value: 'FIXED', label: 'Fixed amount' },
              ]}
            />
          </Field>
          <Field label="Value">
            <Input type="number" value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} />
          </Field>
          <Field label="Fee category">
            <Select
              value={f.categoryId}
              onChange={(e) => setF({ ...f, categoryId: e.target.value })}
              placeholder="All fees"
              options={(cats.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
            />
          </Field>
          <Field label="Reason" className="sm:col-span-2">
            <Input value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}

function Fees() {
  const { me, can } = useAuth();
  const cur = me?.tenant?.currency ?? 'GHS';
  const [tab, setTab] = useState('invoices');
  return (
    <div>
      <PageHeader
        title="Fees & invoices"
        actions={
          can('PAYMENT_RECORD') && (
            <Link href="/school/fees/payments/new" className="btn-primary">
              Record payment
            </Link>
          )
        }
      />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'invoices', label: 'Invoices' },
          { id: 'structures', label: 'Fee structures' },
          { id: 'categories', label: 'Categories' },
          { id: 'discounts', label: 'Discounts' },
        ]}
      />
      {tab === 'invoices' && <InvoicesTab cur={cur} />}
      {tab === 'structures' && <StructuresTab cur={cur} />}
      {tab === 'categories' && <CategoriesTab />}
      {tab === 'discounts' && <DiscountsTab cur={cur} />}
    </div>
  );
}
export default function FeesPage() {
  return (
    <Suspense>
      <Fees />
    </Suspense>
  );
}
