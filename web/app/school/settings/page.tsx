'use client';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { CheckCircle2, Copy, Database, Download, Globe, Plus, Trash2 } from 'lucide-react';
import { downloadBlob } from '@/lib/api';
import { api } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { ago, fmtDate, fmtDateTime, money, title } from '@/lib/format';
import { portalUrlFor } from '@/lib/tenant';
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Spinner,
  Tabs,
  Textarea,
  useToast,
} from '@/components/ui';

function ProfileTab() {
  const toast = useToast();
  const { refresh } = useAuth();
  const { data, loading, reload } = useApi('/school/profile');
  const [f, setF] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (data)
      setF({
        name: data.name,
        type: data.type,
        registrationNumber: data.registrationNumber ?? '',
        region: data.region ?? '',
        district: data.district ?? '',
        address: data.address ?? '',
        phone: data.phone ?? '',
        email: data.email ?? '',
        website: data.website ?? '',
        principalName: data.principalName ?? '',
        currency: data.currency,
        timezone: data.timezone,
        gpsLat: data.gpsLat ?? '',
        gpsLng: data.gpsLng ?? '',
      });
  }, [data]);
  if (loading || !f) return <Spinner />;
  const save = async () => {
    setBusy(true);
    try {
      const body = {
        ...f,
        gpsLat: f.gpsLat === '' ? undefined : Number(f.gpsLat),
        gpsLng: f.gpsLng === '' ? undefined : Number(f.gpsLng),
      };
      Object.keys(body).forEach((k) => body[k] === '' && delete body[k]);
      await api.patch('/school/profile', body);
      toast.success('Profile saved');
      reload();
      refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card
      title="School profile"
      actions={
        <span className="text-xs text-slate-500">
          Code {data.code} · portal {portalUrlFor(data.slug)}
        </span>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="School name">
          <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field label="Ownership" hint="This platform is built for KG/Primary/JHS basic schools. Set the levels you teach under Rules engine">
          <Select
            value={f.type}
            onChange={(e) => setF({ ...f, type: e.target.value })}
            options={[
              { value: 'BASIC', label: 'Public / Government' },
              { value: 'PRIVATE', label: 'Private' },
              { value: 'FAITH_BASED', label: 'Faith-based / Mission' },
              { value: 'COMMUNITY', label: 'Community' },
              { value: 'INTERNATIONAL', label: 'International' },
            ]}
          />
        </Field>
        {[
          ['registrationNumber', 'Registration number'],
          ['principalName', 'Head teacher / principal'],
          ['region', 'Region'],
          ['district', 'District'],
          ['address', 'Address'],
          ['phone', 'Phone'],
          ['email', 'Email'],
          ['website', 'Existing website'],
          ['gpsLat', 'GPS latitude'],
          ['gpsLng', 'GPS longitude'],
          ['currency', 'Currency'],
          ['timezone', 'Time zone'],
        ].map(([k, l]) => (
          <Field key={k} label={l}>
            <Input value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
          </Field>
        ))}
      </div>
      <div className="mt-4 flex justify-end">
        <Button onClick={save} loading={busy}>
          Save profile
        </Button>
      </div>
    </Card>
  );
}

function BrandingTab() {
  const toast = useToast();
  const { me, refresh } = useAuth();
  const [f, setF] = useState<any>({
    logoUrl: me?.tenant?.logoUrl ?? '',
    faviconUrl: me?.tenant?.faviconUrl ?? '',
    primaryColor: me?.tenant?.primaryColor ?? '#1d4ed8',
    secondaryColor: me?.tenant?.secondaryColor ?? '#1e3a8a',
    fontFamily: me?.tenant?.fontFamily ?? 'Inter',
  });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      const body = { ...f };
      Object.keys(body).forEach((k) => body[k] === '' && delete body[k]);
      await api.patch('/school/branding', body);
      toast.success('Branding updated');
      await refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card title="Brand" className="lg:col-span-2">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Logo URL" hint="Square PNG/SVG hosted on your website or a CDN">
            <Input
              value={f.logoUrl}
              onChange={(e) => setF({ ...f, logoUrl: e.target.value })}
              placeholder="https://…/logo.png"
            />
          </Field>
          <Field label="Favicon URL">
            <Input value={f.faviconUrl} onChange={(e) => setF({ ...f, faviconUrl: e.target.value })} />
          </Field>
          <Field label="Primary colour">
            <div className="flex gap-2">
              <input
                type="color"
                value={f.primaryColor}
                onChange={(e) => setF({ ...f, primaryColor: e.target.value })}
                className="h-10 w-14 rounded border"
              />
              <Input value={f.primaryColor} onChange={(e) => setF({ ...f, primaryColor: e.target.value })} />
            </div>
          </Field>
          <Field label="Secondary colour">
            <div className="flex gap-2">
              <input
                type="color"
                value={f.secondaryColor}
                onChange={(e) => setF({ ...f, secondaryColor: e.target.value })}
                className="h-10 w-14 rounded border"
              />
              <Input value={f.secondaryColor} onChange={(e) => setF({ ...f, secondaryColor: e.target.value })} />
            </div>
          </Field>
          <Field label="Font family">
            <Select
              value={f.fontFamily}
              onChange={(e) => setF({ ...f, fontFamily: e.target.value })}
              options={['Inter', 'Poppins', 'Roboto', 'Nunito', 'Lato', 'Merriweather'].map((x) => ({
                value: x,
                label: x,
              }))}
            />
          </Field>
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={save} loading={busy}>
            Save branding
          </Button>
        </div>
      </Card>
      <Card title="Preview">
        <div className="rounded-xl border border-slate-200 p-4" style={{ fontFamily: f.fontFamily }}>
          <div className="flex items-center gap-2">
            {f.logoUrl ? (
              <img src={f.logoUrl} alt="" className="h-10 w-10 rounded object-cover" />
            ) : (
              <div
                className="flex h-10 w-10 items-center justify-center rounded text-white"
                style={{ background: f.primaryColor }}
              >
                {me?.tenant?.name?.[0]}
              </div>
            )}
            <p className="font-semibold">{me?.tenant?.name}</p>
          </div>
          <button
            className="mt-4 rounded-lg px-4 py-2 text-sm font-medium text-white"
            style={{ background: f.primaryColor }}
          >
            Primary button
          </button>
          <div className="mt-2 h-2 rounded" style={{ background: f.secondaryColor }} />
          <p className="mt-3 text-xs text-slate-500">
            Colours apply to the portal, the website, ID cards, receipts and report cards.
          </p>
        </div>
      </Card>
    </div>
  );
}

function RulesTab() {
  const toast = useToast();
  const { refresh } = useAuth();
  const { data, loading, reload } = useApi('/school/settings');
  const [s, setS] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [paystack, setPaystack] = useState('');
  const [gradeLevel, setGradeLevel] = useState<'KG' | 'PRIMARY' | 'JHS'>('PRIMARY');
  useEffect(() => {
    if (data) setS(JSON.parse(JSON.stringify(data)));
  }, [data]);
  if (loading || !s) return <Spinner />;
  const up = (sec: string, k: string, v: any) => setS({ ...s, [sec]: { ...s[sec], [k]: v } });
  const num = (sec: string, k: string) => (e: any) => up(sec, k, Number(e.target.value));
  const save = async () => {
    setBusy(true);
    try {
      const body: any = {
        academic: s.academic,
        attendance: s.attendance,
        finance: { ...s.finance },
        sync: s.sync,
        canteen: s.canteen,
        communication: s.communication,
        school: s.school,
      };
      delete body.finance.paystackSecretKeySet;
      if (paystack) body.finance.paystackSecretKey = paystack;
      await api.patch('/school/settings', body);
      toast.success('Rules saved');
      setPaystack('');
      reload();
      refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  const schemes = s.academic.gradingSchemes ?? {};
  const bands = (schemes[gradeLevel] ?? s.academic.gradingScheme) as any[];
  const setBands = (next: any[]) => up('academic', 'gradingSchemes', { ...schemes, [gradeLevel]: next });
  const levels: Array<'KG' | 'PRIMARY' | 'JHS'> = ['KG', 'PRIMARY', 'JHS'];
  const levelLabels: Record<string, string> = { KG: 'Kindergarten', PRIMARY: 'Primary (Basic 1–6)', JHS: 'JHS (Basic 7–9)' };
  return (
    <div className="space-y-4">
      <Alert kind="info">
        These rules drive the whole system for your school: grading, promotion, attendance, invoicing, offline sync and
        canteen behaviour. Every change is audited.
      </Alert>
      <Card title="School levels & residency">
        <Field label="Levels this school runs" hint="Controls which classes and fee structures apply">
          <div className="flex flex-wrap gap-2">
            {levels.map((l) => {
              const checked = (s.school?.levels ?? []).includes(l);
              return (
                <button
                  key={l}
                  type="button"
                  onClick={() =>
                    up('school', 'levels', checked ? s.school.levels.filter((x: string) => x !== l) : [...(s.school?.levels ?? []), l])
                  }
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${checked ? 'border-brand bg-brand-soft text-brand-dark' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}
                >
                  {levelLabels[l]}
                </button>
              );
            })}
          </div>
        </Field>
        <Field label="Day or boarding?" className="mt-3 max-w-xs">
          <Select
            value={s.school?.residency ?? 'DAY'}
            onChange={(e) => up('school', 'residency', e.target.value)}
            options={[
              { value: 'DAY', label: 'Day school' },
              { value: 'BOARDING', label: 'Boarding school' },
              { value: 'DAY_AND_BOARDING', label: 'Both day and boarding students' },
            ]}
          />
        </Field>
        <p className="mt-2 text-xs text-slate-500">
          Set to &quot;Day school&quot; or &quot;Boarding school&quot; only, students can&apos;t be enrolled with the other residency.
          Choose &quot;Both&quot; to decide per student.
        </p>
      </Card>
      <Card title="Academic rules">
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Class score weight (%)">
            <Input type="number" value={s.academic.caWeight} onChange={num('academic', 'caWeight')} />
          </Field>
          <Field label="Exam weight (%)">
            <Input type="number" value={s.academic.examWeight} onChange={num('academic', 'examWeight')} />
          </Field>
          <Field label="Pass mark (%)">
            <Input type="number" value={s.academic.passMark} onChange={num('academic', 'passMark')} />
          </Field>
          <Field label="Promotion average (%)" hint="At or above this, a student is promoted outright">
            <Input type="number" value={s.academic.promotionAverage} onChange={num('academic', 'promotionAverage')} />
          </Field>
          <Field
            label="Probation average (%)"
            hint="Between this and the promotion average, a student still moves up but is flagged for the new teacher to watch. Below this, they repeat the year."
          >
            <Input
              type="number"
              value={s.academic.probationAverage}
              onChange={num('academic', 'probationAverage')}
            />
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap gap-4">
          <Checkbox
            label="Results need academic review before approval"
            checked={s.academic.resultApprovalLevels.includes('REVIEW')}
            onChange={(e) =>
              up(
                'academic',
                'resultApprovalLevels',
                e.target.checked
                  ? [...new Set([...s.academic.resultApprovalLevels, 'REVIEW'])]
                  : s.academic.resultApprovalLevels.filter((x: string) => x !== 'REVIEW'),
              )
            }
          />
          <Checkbox
            label="Results need head teacher approval before publishing"
            checked={s.academic.resultApprovalLevels.includes('APPROVE')}
            onChange={(e) =>
              up(
                'academic',
                'resultApprovalLevels',
                e.target.checked
                  ? [...new Set([...s.academic.resultApprovalLevels, 'APPROVE'])]
                  : s.academic.resultApprovalLevels.filter((x: string) => x !== 'APPROVE'),
              )
            }
          />
          <Checkbox
            label="Show class position on report cards"
            checked={!!s.academic.showPosition}
            onChange={(e) => up('academic', 'showPosition', e.target.checked)}
          />
        </div>
        <p className="label mt-4">Grading scheme</p>
        <p className="mb-2 text-xs text-slate-500">
          KG and Primary usually use letter grades; JHS uses the BECE 1–9 scale. Each level has its own bands.
        </p>
        <div className="mb-2 flex gap-1">
          {levels.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setGradeLevel(l)}
              className={`rounded-md px-3 py-1 text-xs font-medium ${gradeLevel === l ? 'bg-brand text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              {levelLabels[l]}
            </button>
          ))}
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Grade</th>
              <th>Min %</th>
              <th>Max %</th>
              <th>Remark</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {bands.map((b, i) => (
              <tr key={i}>
                <td>
                  <Input
                    value={b.grade}
                    onChange={(e) =>
                      setBands(bands.map((x, j) => (j === i ? { ...x, grade: e.target.value } : x)))
                    }
                  />
                </td>
                <td>
                  <Input
                    type="number"
                    value={b.min}
                    onChange={(e) =>
                      setBands(bands.map((x, j) => (j === i ? { ...x, min: Number(e.target.value) } : x)))
                    }
                  />
                </td>
                <td>
                  <Input
                    type="number"
                    value={b.max}
                    onChange={(e) =>
                      setBands(bands.map((x, j) => (j === i ? { ...x, max: Number(e.target.value) } : x)))
                    }
                  />
                </td>
                <td>
                  <Input
                    value={b.remark}
                    onChange={(e) =>
                      setBands(bands.map((x, j) => (j === i ? { ...x, remark: e.target.value } : x)))
                    }
                  />
                </td>
                <td>
                  <button
                    className="text-red-600"
                    onClick={() =>
                      setBands(bands.filter((_, j) => j !== i))
                    }
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Button
          variant="secondary"
          className="mt-2"
          onClick={() => setBands([...bands, { grade: '', min: 0, max: 0, remark: '' }])}
        >
          <Plus size={14} /> Add band
        </Button>
      </Card>
      <Card title="Attendance">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Minimum attendance (%)">
            <Input
              type="number"
              value={s.attendance.minimumAttendancePercent}
              onChange={num('attendance', 'minimumAttendancePercent')}
            />
          </Field>
          <Field label="Late after (HH:MM)">
            <Input
              value={s.attendance.lateAfter ?? ''}
              onChange={(e) => up('attendance', 'lateAfter', e.target.value)}
            />
          </Field>
          <div className="flex items-end pb-2">
            <Checkbox
              label="Notify parents when a child is absent"
              checked={!!s.attendance.notifyParentsOnAbsence}
              onChange={(e) => up('attendance', 'notifyParentsOnAbsence', e.target.checked)}
            />
          </div>
        </div>
      </Card>
      <Card title="Finance">
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Invoice prefix">
            <Input value={s.finance.invoicePrefix} onChange={(e) => up('finance', 'invoicePrefix', e.target.value)} />
          </Field>
          <Field label="Receipt prefix">
            <Input value={s.finance.receiptPrefix} onChange={(e) => up('finance', 'receiptPrefix', e.target.value)} />
          </Field>
          <Field label="Payment grace (days)">
            <Input type="number" value={s.finance.paymentGraceDays} onChange={num('finance', 'paymentGraceDays')} />
          </Field>
          <Field label="Default installments">
            <Input
              type="number"
              value={s.finance.defaultInstallments}
              onChange={num('finance', 'defaultInstallments')}
            />
          </Field>
          <Field label="Sibling discount (%)">
            <Input
              type="number"
              value={s.finance.siblingDiscountPercent}
              onChange={num('finance', 'siblingDiscountPercent')}
            />
          </Field>
          <Field label="Late fee (%)">
            <Input type="number" value={s.finance.lateFeePercent} onChange={num('finance', 'lateFeePercent')} />
          </Field>
          <Field label="Online payments">
            <Select
              value={s.finance.paymentProvider}
              onChange={(e) => up('finance', 'paymentProvider', e.target.value)}
              options={[
                { value: 'NONE', label: 'Off' },
                { value: 'PAYSTACK', label: 'Paystack (cards & Mobile Money)' },
              ]}
            />
          </Field>
          <Field
            label="Paystack secret key"
            hint={
              s.finance.paystackSecretKeySet
                ? 'A key is stored. Enter a new one to replace it'
                : 'sk_live_… (stored encrypted, never shown)'
            }
          >
            <Input type="password" value={paystack} onChange={(e) => setPaystack(e.target.value)} />
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap gap-4">
          <Checkbox
            label="Allow installment plans"
            checked={!!s.finance.allowInstallments}
            onChange={(e) => up('finance', 'allowInstallments', e.target.checked)}
          />
          <Checkbox
            label="Allow partial payments"
            checked={!!s.finance.allowPartialPayments}
            onChange={(e) => up('finance', 'allowPartialPayments', e.target.checked)}
          />
        </div>
      </Card>
      <Card title="Offline sync">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Conflict policy" hint="What happens when a device and the server disagree">
            <Select
              value={s.sync.conflictPolicy}
              onChange={(e) => up('sync', 'conflictPolicy', e.target.value)}
              options={[
                { value: 'LATEST_WINS', label: 'Latest change wins' },
                { value: 'SERVER_WINS', label: 'Server always wins' },
                { value: 'MANUAL', label: 'Ask an administrator' },
              ]}
            />
          </Field>
          <Field label="Attendance window on devices (days)">
            <Input type="number" value={s.sync.attendanceWindowDays} onChange={num('sync', 'attendanceWindowDays')} />
          </Field>
          <div className="flex items-end pb-2">
            <Checkbox
              label="Allow offline student edits"
              checked={!!s.sync.allowOfflineStudentEdits}
              onChange={(e) => up('sync', 'allowOfflineStudentEdits', e.target.checked)}
            />
          </div>
        </div>
      </Card>
      <Card title="Canteen & communication">
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Default daily wallet limit">
            <Input
              type="number"
              value={s.canteen.defaultDailyLimit ?? 0}
              onChange={num('canteen', 'defaultDailyLimit')}
            />
          </Field>
          <div className="flex items-end pb-2">
            <Checkbox
              label="Allow selling below zero stock"
              checked={!!s.canteen.allowNegativeStock}
              onChange={(e) => up('canteen', 'allowNegativeStock', e.target.checked)}
            />
          </div>
          <Field label="SMS sender ID">
            <Input
              value={s.communication.smsSenderId ?? ''}
              onChange={(e) => up('communication', 'smsSenderId', e.target.value)}
              maxLength={11}
            />
          </Field>
          <div className="flex items-end pb-2">
            <Checkbox
              label="SMS enabled"
              checked={!!s.communication.smsEnabled}
              onChange={(e) => up('communication', 'smsEnabled', e.target.checked)}
            />
          </div>
        </div>
      </Card>
      <div className="flex justify-end">
        <Button onClick={save} loading={busy}>
          Save rules
        </Button>
      </div>
    </div>
  );
}

function DomainsTab() {
  const toast = useToast();
  const { has, me } = useAuth();
  const { data, loading, reload } = useApi<any[]>('/school/domains');
  const [domain, setDomain] = useState('');
  const [busy, setBusy] = useState(false);
  const [inst, setInst] = useState<any>(null);
  const add = async () => {
    setBusy(true);
    try {
      const d = await api.post('/school/domains', { domain });
      setInst(d);
      setDomain('');
      reload();
    } catch (e: any) {
      toast.error(
        e.code === 'FEATURE_NOT_IN_PLAN' ? 'Custom domains are available on the Enterprise plan.' : e.message,
      );
    } finally {
      setBusy(false);
    }
  };
  const verify = async (id: string) => {
    try {
      await api.post(`/school/domains/${id}/verify`);
      toast.success('Domain verified');
      reload();
    } catch (e: any) {
      toast.error(e.message);
    }
  };
  return (
    <div className="space-y-4">
      <Card title="Your addresses" padded={false}>
        <table className="table">
          <thead>
            <tr>
              <th>Domain</th>
              <th>Type</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((d) => (
              <tr key={d.id}>
                <td className="font-medium">
                  {d.domain} {d.isPrimary && <Badge tone="brand">Primary</Badge>}
                </td>
                <td>{title(d.type)}</td>
                <td>
                  {d.verified ? (
                    <span className="flex items-center gap-1 text-emerald-700">
                      <CheckCircle2 size={14} /> Verified
                    </span>
                  ) : (
                    <Badge tone="amber">PENDING</Badge>
                  )}
                </td>
                <td className="text-right text-xs">
                  {!d.verified && (
                    <button className="text-brand hover:underline" onClick={() => verify(d.id)}>
                      Check DNS
                    </button>
                  )}
                  {d.verified && !d.isPrimary && (
                    <button
                      className="ml-2 text-brand hover:underline"
                      onClick={async () => {
                        await api.post(`/school/domains/${d.id}/primary`);
                        reload();
                      }}
                    >
                      Make primary
                    </button>
                  )}
                  {d.type === 'CUSTOM' && (
                    <button
                      className="ml-2 text-red-600 hover:underline"
                      onClick={async () => {
                        if (!confirm('Remove domain?')) return;
                        await api.delete(`/school/domains/${d.id}`);
                        reload();
                      }}
                    >
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {loading && (
              <tr>
                <td colSpan={4}>
                  <Spinner />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
      <Card title="Add your own domain">
        {!has('CUSTOM_DOMAIN') && (
          <Alert kind="warning" className="mb-3">
            Custom domains are part of the Enterprise plan. Your school portal is available at{' '}
            {portalUrlFor(me?.tenant?.slug ?? '')}.
          </Alert>
        )}
        <div className="flex gap-2">
          <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="portal.myschool.edu.gh" />
          <Button onClick={add} loading={busy} disabled={!domain}>
            <Globe size={16} /> Add
          </Button>
        </div>
        {inst && (
          <div className="mt-4 rounded-lg bg-slate-50 p-4 text-sm">
            <p className="mb-2 font-medium">Add these DNS records at your domain registrar:</p>
            <table className="table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Host</th>
                  <th>Value</th>
                  <th>Purpose</th>
                </tr>
              </thead>
              <tbody>
                {inst.instructions.steps.map((s: any, i: number) => (
                  <tr key={i}>
                    <td>{s.type}</td>
                    <td className="font-mono text-xs">{s.host}</td>
                    <td className="font-mono text-xs">
                      {s.value}{' '}
                      <button onClick={() => navigator.clipboard.writeText(s.value)}>
                        <Copy size={12} />
                      </button>
                    </td>
                    <td className="text-xs text-slate-500">{s.purpose}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-slate-500">
              Then click “Check DNS”. Also add the domain to the Vercel project so an SSL certificate is issued.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}

function SubscriptionTab() {
  const toast = useToast();
  const { me, refresh } = useAuth();
  const { data, loading, reload } = useApi('/subscription');
  const [open, setOpen] = useState<any>(null);
  const [cycle, setCycle] = useState<'MONTHLY' | 'YEARLY'>('YEARLY');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
  if (loading || !data) return <Spinner />;
  const sub = data.subscription;
  const request = async () => {
    setBusy(true);
    try {
      const r = await api.post('/subscription/change', { planCode: open.code, billingCycle: cycle });
      setResult(r);
      setOpen(null);
      reload();
      refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-xs text-slate-500">Current plan</p>
          <p className="text-xl font-semibold">{sub.plan.name}</p>
          <Badge>{sub.status}</Badge> <span className="text-xs text-slate-500">{title(sub.billingCycle)}</span>
        </Card>
        <Card>
          <p className="text-xs text-slate-500">{sub.status === 'TRIAL' ? 'Trial ends' : 'Current period ends'}</p>
          <p className="text-xl font-semibold">
            {fmtDate(sub.status === 'TRIAL' ? sub.trialEndsAt : sub.currentPeriodEnd)}
          </p>
          <p className="text-xs text-slate-500">{data.daysLeft} days left</p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500">Students</p>
          <p className="text-xl font-semibold">
            {data.usage.students} / {data.usage.studentLimit.toLocaleString()}
          </p>
          <div className="mt-1 h-2 rounded bg-slate-100">
            <div
              className="h-2 rounded bg-brand"
              style={{ width: `${Math.min(100, data.usage.studentUsagePercent)}%` }}
            />
          </div>
        </Card>
      </div>
      {result && (
        <Alert kind="success">
          Invoice <b>{result.invoice.number}</b> for {money(result.invoice.amount, result.currency)} has been issued.{' '}
          {result.instructions}
          {result.bankDetails ? ` Bank details: ${result.bankDetails}` : ''}
        </Alert>
      )}
      <Card title="Plans">
        <div className="grid gap-3 sm:grid-cols-3">
          {data.plans.map((p: any) => (
            <div
              key={p.id}
              className={`rounded-xl border p-4 ${p.id === sub.planId ? 'border-brand ring-2 ring-brand/20' : 'border-slate-200'}`}
            >
              <p className="font-semibold">{p.name}</p>
              <p className="text-xs text-slate-500">{p.description}</p>
              <p className="mt-2 text-lg font-semibold">
                {money(p.priceYearly, p.currency)}
                <span className="text-xs font-normal text-slate-500">/year</span>
              </p>
              <p className="text-xs text-slate-500">
                or {money(p.priceMonthly, p.currency)}/month · up to {p.studentLimit.toLocaleString()} students
              </p>
              <ul className="mt-2 space-y-0.5 text-xs text-slate-600">
                {p.features.map((f: string) => (
                  <li key={f}>✓ {title(f)}</li>
                ))}
              </ul>
              {p.id !== sub.planId ? (
                <Button className="mt-3 w-full" variant="secondary" onClick={() => setOpen(p)}>
                  Switch to {p.name}
                </Button>
              ) : (
                <p className="mt-3 text-center text-xs font-medium text-brand">Current plan</p>
              )}
            </div>
          ))}
        </div>
      </Card>
      <Card title="Subscription invoices" padded={false}>
        <table className="table">
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Description</th>
              <th>Period</th>
              <th className="text-right">Amount</th>
              <th>Due</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {sub.invoices.map((i: any) => (
              <tr key={i.id}>
                <td className="font-medium">{i.number}</td>
                <td>{i.description.replace(/\s*\[PLAN:[A-Z_]+\]/, '')}</td>
                <td className="text-xs">
                  {fmtDate(i.periodStart)} – {fmtDate(i.periodEnd)}
                </td>
                <td className="text-right">{money(i.amount, i.currency)}</td>
                <td>{fmtDate(i.dueDate)}</td>
                <td>
                  <Badge>{i.status}</Badge>
                </td>
              </tr>
            ))}
            {!sub.invoices.length && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-slate-500">
                  No invoices yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
      <Modal
        open={!!open}
        onClose={() => setOpen(null)}
        title={open ? `Switch to ${open.name}` : ''}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(null)}>
              Cancel
            </Button>
            <Button onClick={request} loading={busy}>
              Request change
            </Button>
          </>
        }
      >
        {open && (
          <div className="space-y-3 text-sm">
            <p>
              An invoice will be issued for the new plan. Your plan switches as soon as the platform confirms the
              payment.
            </p>
            <Field label="Billing cycle">
              <Select
                value={cycle}
                onChange={(e) => setCycle(e.target.value as any)}
                options={[
                  { value: 'YEARLY', label: `Yearly: ${money(open.priceYearly, open.currency)}` },
                  { value: 'MONTHLY', label: `Monthly: ${money(open.priceMonthly, open.currency)}` },
                ]}
              />
            </Field>
          </div>
        )}
      </Modal>
    </div>
  );
}

function DataTab() {
  const toast = useToast();
  const { me } = useAuth();
  const { data, loading, reload } = useApi('/data/summary');
  const [busy, setBusy] = useState<string | null>(null);
  const download = async (format: 'ALL' | 'JSON' | 'CSV' | 'SQL') => {
    setBusy(format);
    try {
      await downloadBlob(
        `/data/export.zip?format=${format}`,
        `${me?.tenant?.slug ?? 'school'}-${format.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.zip`,
      );
      toast.success('Your download has started');
      setTimeout(reload, 1500);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };
  if (loading || !data) return <Spinner />;
  return (
    <div className="space-y-4">
      <Alert kind="info">
        <b>Your school owns its data.</b> Download everything the school has ever stored: students, guardians, staff,
        attendance, fees and payments, results, canteen, messages and more. Password hashes, login sessions and payment
        keys are never included. Every download is recorded below and in the audit log.
      </Alert>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Download my database" className="lg:col-span-2">
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ['ALL', 'Complete backup', 'JSON + CSV + SQL in one ZIP, the recommended full backup.'],
                ['JSON', 'JSON', 'One JSON file per table, machine-readable and re-importable.'],
                ['CSV', 'Spreadsheets (CSV)', 'One CSV per table, opens in Excel or Google Sheets.'],
                [
                  'SQL',
                  'SQL restore script',
                  'INSERT statements in dependency order to restore into a fresh Nimdee database.',
                ],
              ] as const
            ).map(([fmt, label, desc]) => (
              <div key={fmt} className="flex flex-col rounded-xl border border-slate-200 p-4">
                <div className="flex items-center gap-2 font-semibold text-slate-900">
                  <Database size={16} className="text-brand" /> {label}
                </div>
                <p className="mt-1 flex-1 text-xs text-slate-500">{desc}</p>
                <Button
                  className="mt-3"
                  variant={fmt === 'ALL' ? 'primary' : 'secondary'}
                  onClick={() => download(fmt)}
                  loading={busy === fmt}
                >
                  <Download size={15} /> Download {fmt === 'ALL' ? 'ZIP' : fmt}
                </Button>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            {data.totalRows.toLocaleString()} records across {data.tables.filter((t: any) => t.rows > 0).length} tables
            · last export{' '}
            {data.lastExport
              ? `${ago(data.lastExport.createdAt)} by ${data.lastExport.requestedBy ?? 'unknown'}`
              : 'never'}
          </p>
        </Card>
        <Card title="What's included" padded={false}>
          <div className="max-h-80 overflow-y-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Table</th>
                  <th className="text-right">Records</th>
                </tr>
              </thead>
              <tbody>
                {data.tables
                  .filter((t: any) => t.rows > 0)
                  .map((t: any) => (
                    <tr key={t.table}>
                      <td>{t.table.replace(/([A-Z])/g, ' $1').trim()}</td>
                      <td className="text-right">{t.rows.toLocaleString()}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
      <Card title="Download history" padded={false}>
        <table className="table">
          <thead>
            <tr>
              <th>When</th>
              <th>By</th>
              <th>Format</th>
              <th>File</th>
              <th className="text-right">Tables</th>
              <th className="text-right">Records</th>
              <th className="text-right">Size</th>
            </tr>
          </thead>
          <tbody>
            {data.history.map((h: any) => (
              <tr key={h.id}>
                <td>{fmtDateTime(h.createdAt)}</td>
                <td>{h.requestedBy ?? '—'}</td>
                <td>
                  <Badge tone="slate">{h.format}</Badge>
                </td>
                <td className="text-xs">{h.fileName}</td>
                <td className="text-right">{h.tables}</td>
                <td className="text-right">{h.rowCount?.toLocaleString()}</td>
                <td className="text-right">{h.sizeBytes ? `${(h.sizeBytes / 1024).toFixed(0)} KB` : '—'}</td>
              </tr>
            ))}
            {!data.history.length && (
              <tr>
                <td colSpan={7} className="py-4 text-center text-slate-500">
                  No downloads yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

const FEATURE_INFO: Record<string, { label: string; hint: string }> = {
  ACADEMICS: { label: 'Academics', hint: 'Classes, subjects and the academic structure' },
  ATTENDANCE: { label: 'Attendance', hint: 'Daily attendance marking, offline-first' },
  OFFLINE_SYNC: { label: 'Offline sync', hint: 'Devices keep working without internet and sync later' },
  FEES: { label: 'Fees & payments', hint: 'Invoices, installments and Mobile Money/card payments' },
  RESULTS: { label: 'Results', hint: 'Assessments, computed grades and report cards' },
  TIMETABLE: { label: 'Timetable', hint: 'Class and teacher timetables' },
  CANTEEN: { label: 'Canteen', hint: 'Canteen point of sale, wallets and meal plans' },
  PARENT_PORTAL: { label: 'Parent portal', hint: 'The app and website view parents use' },
  WEBSITE: { label: 'School website', hint: 'Your branded public website and online admissions' },
  CUSTOM_DOMAIN: { label: 'Custom domain', hint: 'Use your own domain for the school website' },
  COMMUNICATIONS: { label: 'Announcements & messages', hint: 'Announcements and direct messaging' },
  INVENTORY: { label: 'Inventory', hint: 'Stock and asset tracking' },
  ANALYTICS: { label: 'Analytics', hint: 'Deeper reports and trend charts' },
  DISCIPLINE: { label: 'Discipline', hint: 'Incidents, sanctions and demerit points' },
  EVENTS: { label: 'Calendar & events', hint: 'Holidays, exams, meetings and trips' },
  ASSIGNMENTS: { label: 'Homework & assignments', hint: 'Assignments teachers set and grade' },
  LIBRARY: { label: 'Library', hint: 'Book catalogue and loans' },
  TRANSPORT: { label: 'Transport', hint: 'Routes, vehicles and student transport assignments' },
  HEALTH: { label: 'Health & clinic', hint: 'Sick-bay visits, allergies and conditions' },
  MESSAGING: { label: 'Messaging', hint: 'In-app conversations between staff, parents and students' },
  HR: { label: 'HR & payroll', hint: 'Staff leave, payroll and HR records' },
};

/**
 * Lets a school's own admins hide features their plan includes from every user at the school, without
 * needing the platform owner involved. Academics and Attendance are always on since the rest of the
 * app depends on them.
 */
function FeaturesTab() {
  const toast = useToast();
  const { refresh } = useAuth();
  const { data, loading, reload } = useApi('/school/features');
  const [disabled, setDisabled] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (data) setDisabled(data.disabledFeatures);
  }, [data]);
  if (loading || !data || disabled === null) return <Spinner />;
  const toggle = (f: string) =>
    setDisabled((prev) => (prev!.includes(f) ? prev!.filter((x) => x !== f) : [...prev!, f]));
  const save = async () => {
    setBusy(true);
    try {
      await api.patch('/school/features', { disabledFeatures: disabled });
      toast.success('Features updated');
      await refresh();
      reload();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card
      title="Features shown to your school"
      actions={
        <Button onClick={save} loading={busy}>
          Save changes
        </Button>
      }
    >
      <p className="mb-4 text-sm text-slate-500">
        Turn off anything your school does not use. Hidden features disappear from navigation and
        dashboards for every admin, teacher, staff member and parent, not just you.
      </p>
      <div className="grid gap-1 sm:grid-cols-2">
        {data.locked.map((f: string) => (
          <div key={f} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-400">
            <input type="checkbox" checked disabled className="h-4 w-4 rounded border-slate-200" />
            <span className="font-medium">{FEATURE_INFO[f]?.label ?? title(f)}</span>
            <span className="text-xs">(always on)</span>
          </div>
        ))}
        {data.planFeatures
          .filter((f: string) => !data.locked.includes(f))
          .map((f: string) => (
            <label
              key={f}
              className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50"
            >
              <input
                type="checkbox"
                checked={!disabled.includes(f)}
                onChange={() => toggle(f)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
              />
              <span>
                <span className="block font-medium text-slate-800">{FEATURE_INFO[f]?.label ?? title(f)}</span>
                <span className="text-xs text-slate-500">{FEATURE_INFO[f]?.hint ?? ''}</span>
              </span>
            </label>
          ))}
      </div>
      {!data.planFeatures.filter((f: string) => !data.locked.includes(f)).length && (
        <p className="py-6 text-center text-sm text-slate-500">
          Your current plan does not include any optional features yet.
        </p>
      )}
    </Card>
  );
}

function Settings() {
  const params = useSearchParams();
  const { can } = useAuth();
  const tabs = [
    ...(can('SCHOOL_MANAGE')
      ? [
          { id: 'profile', label: 'Profile' },
          { id: 'branding', label: 'Branding' },
          { id: 'features', label: 'Features' },
        ]
      : []),
    ...(can('SETTINGS_MANAGE') ? [{ id: 'rules', label: 'Rules engine' }] : []),
    ...(can('SCHOOL_MANAGE') ? [{ id: 'domains', label: 'Domains' }] : []),
    ...(can('SUBSCRIPTION_MANAGE') ? [{ id: 'subscription', label: 'Subscription' }] : []),
    ...(can('SCHOOL_MANAGE') ? [{ id: 'data', label: 'Data & backup' }] : []),
  ];
  const [tab, setTab] = useState(params.get('tab') ?? tabs[0]?.id ?? 'profile');
  return (
    <div>
      <PageHeader title="Settings" />
      <Tabs value={tab} onChange={setTab} tabs={tabs} />
      {tab === 'profile' && <ProfileTab />}
      {tab === 'branding' && <BrandingTab />}
      {tab === 'features' && <FeaturesTab />}
      {tab === 'rules' && <RulesTab />}
      {tab === 'domains' && <DomainsTab />}
      {tab === 'subscription' && <SubscriptionTab />}
      {tab === 'data' && <DataTab />}
    </div>
  );
}
export default function SettingsPage() {
  return (
    <Suspense>
      <Settings />
    </Suspense>
  );
}
