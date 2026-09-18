'use client';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { api, downloadBlob } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { ago, fmtDate, fmtDateTime, money, title } from '@/lib/format';
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Description,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Spinner,
  Tabs,
  useToast,
} from '@/components/ui';

function DataTab({ id }: { id: string }) {
  const toast = useToast();
  const { data, loading } = useApi(`/platform/schools/${id}/data-summary`);
  const [busy, setBusy] = useState(false);
  if (loading || !data) return <Spinner />;
  const download = async (format: string) => {
    setBusy(true);
    try {
      await downloadBlob(
        `/platform/schools/${id}/export.zip?format=${format}`,
        `school-${id.slice(0, 8)}-${format.toLowerCase()}.zip`,
      );
      toast.success('Download started (audited as a platform export)');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card title="Download this school's data" className="lg:col-span-2">
        <Alert kind="warning" className="mb-3">
          Platform exports are audited against your account and visible to the school in its export history. Use them
          for support, migrations and backups only.
        </Alert>
        <div className="flex flex-wrap gap-2">
          {['ALL', 'JSON', 'CSV', 'SQL'].map((f) => (
            <Button key={f} variant={f === 'ALL' ? 'primary' : 'secondary'} onClick={() => download(f)} loading={busy}>
              Download {f === 'ALL' ? 'complete ZIP' : f}
            </Button>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          {data.totalRows?.toLocaleString()} records · last export{' '}
          {data.lastExport ? `${fmtDateTime(data.lastExport.createdAt)} by ${data.lastExport.requestedBy}` : 'never'}
        </p>
      </Card>
      <Card title="Tables" padded={false}>
        <div className="max-h-96 overflow-y-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Table</th>
                <th className="text-right">Rows</th>
              </tr>
            </thead>
            <tbody>
              {data.tables
                .filter((t: any) => t.rows > 0)
                .map((t: any) => (
                  <tr key={t.table}>
                    <td>{t.table}</td>
                    <td className="text-right">{t.rows.toLocaleString()}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export default function PlatformSchoolDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { data: s, loading, reload } = useApi(`/platform/schools/${id}`);
  const plans = useApi<any[]>('/platform/plans');
  const [tab, setTab] = useState('overview');
  const [modal, setModal] = useState<string | null>(null);
  const [f, setF] = useState<any>({});
  const [busy, setBusy] = useState(false);
  if (loading || !s) return <Spinner />;
  const act = async (fn: () => Promise<any>, msg: string) => {
    setBusy(true);
    try {
      const r = await fn();
      toast.success(msg);
      setModal(null);
      reload();
      return r;
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  const support = async () => {
    const reason = prompt('Reason for the support session (audited)');
    if (!reason || reason.length < 5) return;
    const r = await act(
      () => api.post(`/platform/schools/${id}/support-session`, { reason }),
      'Support session started',
    );
    if (r) {
      const w = window.open('', '_blank');
      if (w) {
        w.document.write(
          `<p style="font-family:sans-serif">Support session for <b>${s.name}</b> (acting as ${r.actingAs}, ${r.expiresInMinutes} min).<br/>Open the school portal and paste this token into the browser console:<br/><code>localStorage.setItem('schoolos.access','${r.accessToken}');localStorage.setItem('schoolos.slug','${s.slug}');location.href='/school'</code></p>`,
        );
      }
    }
  };
  const sub = s.subscription;
  return (
    <div>
      <PageHeader
        back={() => router.back()}
        title={
          <>
            {s.name} <Badge>{s.status}</Badge>
          </>
        }
        subtitle={`${s.code} · ${s.slug} · registered ${fmtDate(s.createdAt)}`}
        actions={
          <>
            {s.status === 'PENDING' && (
              <>
                <Button
                  onClick={() => act(() => api.post(`/platform/schools/${id}/approve`, {}), 'School approved')}
                  loading={busy}
                >
                  Approve
                </Button>
                <Button
                  variant="danger"
                  onClick={() => {
                    const reason = prompt('Reason for rejection');
                    if (reason) act(() => api.post(`/platform/schools/${id}/reject`, { reason }), 'School rejected');
                  }}
                >
                  Reject
                </Button>
              </>
            )}
            {s.status === 'ACTIVE' && (
              <Button
                variant="danger"
                onClick={() => {
                  const reason = prompt('Reason for suspension');
                  if (reason) act(() => api.post(`/platform/schools/${id}/suspend`, { reason }), 'School suspended');
                }}
              >
                Suspend
              </Button>
            )}
            {s.status === 'SUSPENDED' && (
              <Button onClick={() => act(() => api.post(`/platform/schools/${id}/activate`, {}), 'School reactivated')}>
                Reactivate
              </Button>
            )}
            <Button variant="secondary" onClick={support}>
              <KeyRound size={16} /> Support session
            </Button>
          </>
        }
      />
      {s.suspendedReason && (
        <Alert kind="warning" className="mb-4">
          Suspended: {s.suspendedReason}
        </Alert>
      )}
      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <Card>
          <p className="text-xs text-slate-500">Students</p>
          <p className="text-xl font-semibold">
            {s.usage.students}{' '}
            <span className="text-sm font-normal text-slate-500">/ {sub?.plan?.studentLimit?.toLocaleString()}</span>
          </p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500">Staff / users</p>
          <p className="text-xl font-semibold">
            {s.usage.staff} / {s.usage.users}
          </p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500">Last login</p>
          <p className="text-xl font-semibold">{s.usage.lastLoginAt ? ago(s.usage.lastLoginAt) : 'never'}</p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500">Sync</p>
          <p className="text-xl font-semibold">{s.sync.devices.length} devices</p>
          <p className="text-xs text-slate-500">{s.sync.openConflicts} open conflicts</p>
        </Card>
      </div>
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'overview', label: 'Overview' },
          { id: 'subscription', label: 'Subscription & billing' },
          { id: 'features', label: 'Features' },
          { id: 'data', label: 'Data & backup' },
          { id: 'audit', label: 'Recent activity' },
        ]}
      />
      {tab === 'overview' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Profile">
            <Description
              items={[
                ['Type', s.type],
                ['Region', s.region],
                ['District', s.district],
                ['Address', s.address],
                ['Phone', s.phone],
                ['Email', s.email],
                ['Head teacher', s.principalName],
                ['Country', s.country],
                ['Currency', s.currency],
                ['Approved', fmtDate(s.approvedAt)],
              ]}
            />
          </Card>
          <Card title="Domains" padded={false}>
            <table className="table">
              <thead>
                <tr>
                  <th>Domain</th>
                  <th>Type</th>
                  <th>Verified</th>
                </tr>
              </thead>
              <tbody>
                {s.domains.map((d: any) => (
                  <tr key={d.id}>
                    <td>
                      {d.domain}
                      {d.isPrimary && (
                        <Badge tone="brand" className="ml-1">
                          Primary
                        </Badge>
                      )}
                    </td>
                    <td>{title(d.type)}</td>
                    <td>{d.verified ? '✔' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}
      {tab === 'subscription' && sub && (
        <div className="space-y-4">
          <Card
            title="Subscription"
            actions={
              <>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setF({
                      planId: sub.planId,
                      status: sub.status,
                      billingCycle: sub.billingCycle,
                      currentPeriodEnd: String(sub.currentPeriodEnd).slice(0, 10),
                      reason: '',
                    });
                    setModal('sub');
                  }}
                >
                  Edit
                </Button>
                <Button
                  onClick={() => {
                    setF({ billingCycle: sub.billingCycle, amount: '', dueDate: '', description: '' });
                    setModal('invoice');
                  }}
                >
                  Issue invoice
                </Button>
              </>
            }
          >
            <Description
              items={[
                ['Plan', sub.plan.name],
                ['Status', <Badge key="s">{sub.status}</Badge>],
                ['Billing cycle', title(sub.billingCycle)],
                ['Trial ends', fmtDate(sub.trialEndsAt)],
                ['Current period', `${fmtDate(sub.currentPeriodStart)} – ${fmtDate(sub.currentPeriodEnd)}`],
                ['Grace until', fmtDate(sub.graceUntil)],
              ]}
            />
          </Card>
          <Card title="Invoices" padded={false}>
            <table className="table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Description</th>
                  <th className="text-right">Amount</th>
                  <th>Due</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sub.invoices.map((i: any) => (
                  <tr key={i.id}>
                    <td className="font-medium">{i.number}</td>
                    <td>{i.description}</td>
                    <td className="text-right">{money(i.amount, i.currency)}</td>
                    <td>{fmtDate(i.dueDate)}</td>
                    <td>
                      <Badge>{i.status}</Badge>
                    </td>
                    <td>
                      {i.status === 'PENDING' && (
                        <button
                          className="text-xs text-brand hover:underline"
                          onClick={() => {
                            const reference = prompt('Payment reference (bank/MoMo)') ?? '';
                            act(
                              () => api.post(`/platform/subscription-invoices/${i.id}/mark-paid`, { reference }),
                              'Invoice marked paid, plan applied',
                            );
                          }}
                        >
                          Mark paid
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {!sub.invoices.length && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-500">
                      No invoices
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
        </div>
      )}
      {tab === 'features' && (
        <Card
          title="Feature overrides"
          actions={
            <Button
              onClick={() =>
                act(
                  () =>
                    api.patch(`/platform/schools/${id}/features`, {
                      featureOverrides: f.features ?? s.featureOverrides,
                    }),
                  'Features updated',
                )
              }
            >
              Save
            </Button>
          }
        >
          <p className="mb-3 text-sm text-slate-600">
            Plan features: {sub?.plan?.features?.map((x: string) => title(x)).join(', ')}. Overrides grant extra modules
            regardless of plan.
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {s.allFeatures.map((x: string) => (
              <Checkbox
                key={x}
                label={title(x)}
                checked={(f.features ?? s.featureOverrides).includes(x)}
                onChange={(e) => {
                  const cur = f.features ?? s.featureOverrides;
                  setF({ ...f, features: e.target.checked ? [...cur, x] : cur.filter((y: string) => y !== x) });
                }}
              />
            ))}
          </div>
        </Card>
      )}
      {tab === 'data' && <DataTab id={id} />}
      {tab === 'audit' && (
        <Card padded={false}>
          <table className="table">
            <thead>
              <tr>
                <th>When</th>
                <th>Who</th>
                <th>Action</th>
                <th>Entity</th>
              </tr>
            </thead>
            <tbody>
              {s.recentAudit.map((a: any) => (
                <tr key={a.id}>
                  <td>{fmtDateTime(a.createdAt)}</td>
                  <td>{a.actorName}</td>
                  <td>
                    <Badge tone="slate">{title(a.action)}</Badge>
                  </td>
                  <td>{a.entity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      <Modal
        open={modal === 'sub'}
        onClose={() => setModal(null)}
        title="Edit subscription"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                act(
                  () =>
                    api.patch(`/platform/schools/${id}/subscription`, {
                      ...f,
                      currentPeriodEnd: f.currentPeriodEnd ? new Date(f.currentPeriodEnd).toISOString() : undefined,
                      reason: f.reason || undefined,
                    }),
                  'Subscription updated',
                )
              }
              loading={busy}
            >
              Save
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Plan">
            <Select
              value={f.planId}
              onChange={(e) => setF({ ...f, planId: e.target.value })}
              options={(plans.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
            />
          </Field>
          <Field label="Status">
            <Select
              value={f.status}
              onChange={(e) => setF({ ...f, status: e.target.value })}
              options={['TRIAL', 'ACTIVE', 'PAST_DUE', 'GRACE', 'SUSPENDED', 'CANCELLED'].map((x) => ({
                value: x,
                label: title(x),
              }))}
            />
          </Field>
          <Field label="Billing cycle">
            <Select
              value={f.billingCycle}
              onChange={(e) => setF({ ...f, billingCycle: e.target.value })}
              options={[
                { value: 'MONTHLY', label: 'Monthly' },
                { value: 'YEARLY', label: 'Yearly' },
              ]}
            />
          </Field>
          <Field label="Period ends">
            <Input
              type="date"
              value={f.currentPeriodEnd}
              onChange={(e) => setF({ ...f, currentPeriodEnd: e.target.value })}
            />
          </Field>
          <Field label="Reason" className="sm:col-span-2">
            <Input value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} />
          </Field>
        </div>
      </Modal>
      <Modal
        open={modal === 'invoice'}
        onClose={() => setModal(null)}
        title="Issue subscription invoice"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                act(
                  () =>
                    api.post(`/platform/schools/${id}/subscription/invoices`, {
                      billingCycle: f.billingCycle,
                      amount: f.amount === '' ? undefined : Number(f.amount),
                      dueDate: f.dueDate || undefined,
                      description: f.description || undefined,
                    }),
                  'Invoice issued',
                )
              }
              loading={busy}
            >
              Issue
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Billing cycle">
            <Select
              value={f.billingCycle}
              onChange={(e) => setF({ ...f, billingCycle: e.target.value })}
              options={[
                { value: 'MONTHLY', label: 'Monthly' },
                { value: 'YEARLY', label: 'Yearly' },
              ]}
            />
          </Field>
          <Field label="Amount override" hint="Blank = plan price">
            <Input type="number" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
          </Field>
          <Field label="Due date">
            <Input type="date" value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} />
          </Field>
          <Field label="Description">
            <Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
