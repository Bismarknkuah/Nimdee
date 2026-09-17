'use client';
import { useState } from 'react';
import { Briefcase, Plus } from 'lucide-react';
import { api, openBlob, qs } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { fmtDate, fmtDateTime, money, title } from '@/lib/format';
import {
  Alert,
  Badge,
  Button,
  Card,
  DataTable,
  Field,
  Input,
  KeyStat,
  Modal,
  PageHeader,
  Select,
  Tabs,
  Textarea,
  useToast,
} from '@/components/ui';

const LEAVE_TYPES = ['ANNUAL', 'SICK', 'MATERNITY', 'PATERNITY', 'STUDY', 'COMPASSIONATE', 'UNPAID', 'OTHER'];

function LeaveTab() {
  const toast = useToast();
  const { can, me } = useAuth();
  const manager = can('HR_MANAGE');
  const [status, setStatus] = useState(manager ? 'PENDING' : '');
  const { data, loading, reload } = useApi(`/hr/leave${qs({ status, pageSize: 50 })}`, [status]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState<any>({ type: 'ANNUAL', startDate: '', endDate: '', reason: '' });
  const request = async () => {
    setBusy(true);
    try {
      await api.post('/hr/leave', f);
      toast.success('Leave request sent for approval');
      setOpen(false);
      reload();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  const review = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    const note = prompt(`Note for the staff member (optional)`) ?? undefined;
    try {
      await api.post(`/hr/leave/${id}/review`, { status, note: note || undefined });
      toast.success(`Request ${status.toLowerCase()}`);
      reload();
    } catch (e: any) {
      toast.error(e.message);
    }
  };
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {['', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'].map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${status === s ? 'bg-brand text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}
          >
            {s ? title(s) : 'All'}
          </button>
        ))}
        <div className="ml-auto">
          {me?.links?.staffId && (
            <Button onClick={() => setOpen(true)}>
              <Plus size={16} /> Request leave
            </Button>
          )}
        </div>
      </div>
      <DataTable
        rows={data?.items}
        loading={loading}
        emptyTitle="No leave requests"
        columns={[
          {
            key: 'staff',
            header: 'Staff',
            render: (l: any) => (
              <div>
                <p className="font-medium">
                  {l.staff.firstName} {l.staff.lastName}
                </p>
                <p className="text-xs text-slate-500">{l.staff.position ?? l.staff.employeeId}</p>
              </div>
            ),
          },
          { key: 'type', header: 'Type', render: (l: any) => title(l.type) },
          { key: 'dates', header: 'Dates', render: (l: any) => `${fmtDate(l.startDate)} – ${fmtDate(l.endDate)}` },
          { key: 'days', header: 'Days', align: 'right' },
          { key: 'reason', header: 'Reason', render: (l: any) => l.reason ?? '—' },
          {
            key: 'status',
            header: 'Status',
            render: (l: any) => (
              <div>
                <Badge>{l.status}</Badge>
                {l.reviewNote && <p className="mt-0.5 text-xs text-slate-500">{l.reviewNote}</p>}
              </div>
            ),
          },
          {
            key: 'x',
            header: '',
            render: (l: any) =>
              l.status === 'PENDING' && (
                <div className="flex gap-2 text-xs">
                  {manager && (
                    <>
                      <button className="text-emerald-700 hover:underline" onClick={() => review(l.id, 'APPROVED')}>
                        Approve
                      </button>
                      <button className="text-red-600 hover:underline" onClick={() => review(l.id, 'REJECTED')}>
                        Reject
                      </button>
                    </>
                  )}
                  {l.staffId === me?.links?.staffId && (
                    <button
                      className="text-slate-500 hover:underline"
                      onClick={async () => {
                        await api.post(`/hr/leave/${l.id}/cancel`);
                        reload();
                      }}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              ),
          },
        ]}
      />
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Request leave"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={request} loading={busy} disabled={!f.startDate || !f.endDate}>
              Submit
            </Button>
          </>
        }
      >
        <div className="grid gap-3">
          <Field label="Type">
            <Select
              value={f.type}
              onChange={(e) => setF({ ...f, type: e.target.value })}
              options={LEAVE_TYPES.map((t) => ({ value: t, label: title(t) }))}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="From">
              <Input type="date" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} />
            </Field>
            <Field label="To">
              <Input type="date" value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} />
            </Field>
          </div>
          <Field label="Reason">
            <Textarea value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}

function PayrollTab({ cur }: { cur: string }) {
  const toast = useToast();
  const { data: runs, loading, reload } = useApi<any[]>('/hr/payroll');
  const [sel, setSel] = useState<string | null>(null);
  const { data: run, reload: reloadRun } = useApi(sel ? `/hr/payroll/${sel}` : null, [sel]);
  const [rows, setRows] = useState<Record<string, any>>({});
  const [busy, setBusy] = useState(false);
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const create = async () => {
    setBusy(true);
    try {
      const r = await api.post('/hr/payroll', { period });
      toast.success('Payroll draft created from staff salaries');
      reload();
      setSel(r.id);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  const edit = (staffId: string, k: string, v: string, item: any) =>
    setRows({
      ...rows,
      [staffId]: {
        basic: Number(item.basic),
        allowances: Number(item.allowances),
        deductions: Number(item.deductions),
        notes: item.notes ?? '',
        ...(rows[staffId] ?? {}),
        [k]: k === 'notes' ? v : Number(v),
      },
    });
  const save = async () => {
    setBusy(true);
    try {
      const items = Object.entries(rows).map(([staffId, r]: any) => ({
        staffId,
        basic: r.basic,
        allowances: r.allowances,
        deductions: r.deductions,
        notes: r.notes || undefined,
      }));
      if (!items.length) return toast.info('Nothing changed');
      await api.put(`/hr/payroll/${sel}/items`, { items });
      toast.success('Payroll updated');
      setRows({});
      reloadRun();
      reload();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  const transition = async (action: string) => {
    try {
      await api.post(`/hr/payroll/${sel}/${action}`);
      toast.success(
        `Payroll ${action}d`
          .replace('approveed', 'approved')
          .replace('payd', 'marked paid')
          .replace('reopened', 'reopened'),
      );
      reloadRun();
      reload();
    } catch (e: any) {
      toast.error(e.message);
    }
  };
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-3">
        <Card title="New payroll run">
          <div className="flex gap-2">
            <Input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} />
            <Button onClick={create} loading={busy}>
              Create
            </Button>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Pre-filled from each staff member&apos;s basic salary. Edit allowances/deductions, approve, then mark paid.
          </p>
        </Card>
        <Card padded={false} title="Runs">
          {loading ? (
            <p className="p-4 text-sm">Loading…</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {(runs ?? []).map((r) => (
                <li key={r.id}>
                  <button
                    onClick={() => {
                      setSel(r.id);
                      setRows({});
                    }}
                    className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-slate-50 ${sel === r.id ? 'bg-brand-soft/50' : ''}`}
                  >
                    <span>
                      <b>{r.period}</b>
                      <span className="block text-xs text-slate-500">
                        {r.staffCount} staff · net {money(r.totalNet, cur)}
                      </span>
                    </span>
                    <Badge>{r.status}</Badge>
                  </button>
                </li>
              ))}
              {runs && !runs.length && <li className="p-4 text-sm text-slate-500">No payroll runs yet</li>}
            </ul>
          )}
        </Card>
      </div>
      <div className="lg:col-span-2">
        {run ? (
          <Card
            title={
              <span>
                Payroll {run.period} <Badge>{run.status}</Badge>
              </span>
            }
            actions={
              <div className="flex gap-2">
                {run.status === 'DRAFT' && (
                  <>
                    <Button variant="secondary" onClick={save} loading={busy} disabled={!Object.keys(rows).length}>
                      Save changes
                    </Button>
                    <Button onClick={() => confirm('Approve this payroll run?') && transition('approve')}>
                      Approve
                    </Button>
                  </>
                )}
                {run.status === 'APPROVED' && (
                  <>
                    <Button variant="secondary" onClick={() => transition('reopen')}>
                      Reopen
                    </Button>
                    <Button onClick={() => confirm('Mark this run as paid?') && transition('pay')}>Mark paid</Button>
                  </>
                )}
              </div>
            }
            padded={false}
          >
            <div className="grid grid-cols-3 gap-3 border-b border-slate-100 p-4">
              <KeyStat label="Gross" value={money(run.totalGross, cur)} />
              <KeyStat label="Deductions" value={money(run.totalDeductions, cur)} tone="amber" />
              <KeyStat label="Net pay" value={money(run.totalNet, cur)} tone="emerald" />
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th>Staff</th>
                  <th className="text-right">Basic</th>
                  <th className="text-right">Allowances</th>
                  <th className="text-right">Deductions</th>
                  <th className="text-right">Net</th>
                  <th>Notes</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {run.items.map((it: any) => {
                  const r = rows[it.staffId];
                  const ed = run.status === 'DRAFT';
                  const basic = r?.basic ?? Number(it.basic),
                    allow = r?.allowances ?? Number(it.allowances),
                    ded = r?.deductions ?? Number(it.deductions);
                  return (
                    <tr key={it.id}>
                      <td>
                        <p className="font-medium">
                          {it.staff.firstName} {it.staff.lastName}
                        </p>
                        <p className="text-xs text-slate-500">{it.staff.position ?? it.staff.employeeId}</p>
                      </td>
                      <td className="text-right">
                        {ed ? (
                          <input
                            type="number"
                            className="input w-28 text-right"
                            value={basic}
                            onChange={(e) => edit(it.staffId, 'basic', e.target.value, it)}
                          />
                        ) : (
                          money(it.basic, cur)
                        )}
                      </td>
                      <td className="text-right">
                        {ed ? (
                          <input
                            type="number"
                            className="input w-28 text-right"
                            value={allow}
                            onChange={(e) => edit(it.staffId, 'allowances', e.target.value, it)}
                          />
                        ) : (
                          money(it.allowances, cur)
                        )}
                      </td>
                      <td className="text-right">
                        {ed ? (
                          <input
                            type="number"
                            className="input w-28 text-right"
                            value={ded}
                            onChange={(e) => edit(it.staffId, 'deductions', e.target.value, it)}
                          />
                        ) : (
                          money(it.deductions, cur)
                        )}
                      </td>
                      <td className="text-right font-semibold">{money(basic + allow - ded, cur)}</td>
                      <td>
                        {ed ? (
                          <input
                            className="input"
                            value={r?.notes ?? it.notes ?? ''}
                            onChange={(e) => edit(it.staffId, 'notes', e.target.value, it)}
                          />
                        ) : (
                          (it.notes ?? '')
                        )}
                      </td>
                      <td className="text-right">
                        <button
                          className="text-xs text-brand hover:underline"
                          onClick={() => openBlob(`/documents/payroll/${run.id}/payslips/${it.staffId}.pdf`)}
                        >
                          Payslip
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {run.paidAt && (
              <p className="p-3 text-xs text-slate-500">
                Approved {fmtDateTime(run.approvedAt)} · paid {fmtDateTime(run.paidAt)}
              </p>
            )}
          </Card>
        ) : (
          <Card>
            <p className="py-8 text-center text-sm text-slate-500">Select or create a payroll run.</p>
          </Card>
        )}
      </div>
    </div>
  );
}

export default function HrPage() {
  const { can, me } = useAuth();
  const cur = me?.tenant?.currency ?? 'GHS';
  const summary = useApi(can('HR_MANAGE', 'PAYROLL_MANAGE') ? '/hr/summary' : null);
  const [tab, setTab] = useState('leave');
  const s = summary.data;
  return (
    <div>
      <PageHeader title="HR & payroll" subtitle="Leave requests, approvals and monthly payroll" />
      {s && (
        <div className="mb-4 grid gap-3 sm:grid-cols-4">
          <KeyStat label="Pending leave" value={s.pendingLeave} tone={s.pendingLeave ? 'amber' : 'emerald'} />
          <KeyStat
            label="On leave today"
            value={s.onLeaveToday}
            sub={s.onLeave
              .slice(0, 2)
              .map((l: any) => `${l.staff.firstName} ${l.staff.lastName}`)
              .join(', ')}
          />
          <KeyStat
            label="Teaching / non-teaching"
            value={`${s.staffByType.TEACHING ?? 0} / ${s.staffByType.NON_TEACHING ?? 0}`}
          />
          <KeyStat
            label="Last payroll"
            value={s.lastPayroll ? s.lastPayroll.period : '—'}
            sub={s.lastPayroll ? `${title(s.lastPayroll.status)} · ${money(s.lastPayroll.totalNet, cur)}` : undefined}
          />
        </div>
      )}
      {!me?.links?.staffId && !can('HR_MANAGE') && (
        <Alert kind="info" className="mb-4">
          Your login is not linked to a staff record, so you cannot request leave.
        </Alert>
      )}
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'leave', label: 'Leave' },
          ...(can('PAYROLL_MANAGE') ? [{ id: 'payroll', label: 'Payroll' }] : []),
        ]}
      />
      {tab === 'leave' && <LeaveTab />}
      {tab === 'payroll' && <PayrollTab cur={cur} />}
    </div>
  );
}
