'use client';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { FileDown, KeyRound, Pencil, ShieldCheck } from 'lucide-react';
import { api, openBlob } from '@/lib/api';
import { useAcademic } from '@/lib/academic';
import { useApi } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { fmtDate, money, title } from '@/lib/format';
import { StudentForm } from '@/components/StudentForm';
import {
  Avatar,
  Badge,
  Button,
  Card,
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

export default function StudentDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { can, me, has } = useAuth();
  const { classes } = useAcademic();
  const { data: s, loading, reload } = useApi(`/students/${id}`);
  const [tab, setTab] = useState('overview');
  const [edit, setEdit] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [g, setG] = useState<any>({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    relationship: 'PARENT',
    isPrimary: false,
  });
  const { data: attendance } = useApi(tab === 'attendance' ? `/attendance/student/${id}` : null, [tab]);
  const { data: statement } = useApi(tab === 'fees' && has('FEES') ? `/fees/students/${id}/statement` : null, [tab]);
  const { data: wallet } = useApi(tab === 'wallet' && has('CANTEEN') ? `/canteen/wallets/${id}` : null, [tab]);
  if (loading || !s) return <Spinner />;
  const cur = me?.tenant?.currency;
  const act = async (fn: () => Promise<any>, ok: string) => {
    try {
      const r = await fn();
      toast.success(ok);
      reload();
      return r;
    } catch (e: any) {
      toast.error(e.message);
    }
  };
  return (
    <div>
      <PageHeader
        back={() => router.back()}
        title={
          <span className="flex items-center gap-3">
            <Avatar name={`${s.firstName} ${s.lastName}`} src={s.photoUrl} size="lg" />
            {s.firstName} {s.otherNames} {s.lastName} <Badge>{s.status}</Badge>
          </span>
        }
        subtitle={`${s.studentId} · ${s.class?.name ?? 'No class'}${s.isBoarding ? ' · Boarding' : ''}`}
        actions={
          <>
            {can('STUDENT_VIEW') && (
              <Link href={`/school/id-cards?studentId=${s.id}`} className="btn-secondary">
                <ShieldCheck size={16} /> ID card
              </Link>
            )}
            {has('RESULTS') && (
              <Button variant="secondary" onClick={() => openBlob(`/documents/students/${id}/transcript.pdf`)}>
                <FileDown size={16} /> Transcript
              </Button>
            )}
            {can('USERS_MANAGE') && !s.user && (
              <Button
                variant="secondary"
                onClick={() =>
                  act(async () => {
                    const r = await api.post(`/students/${id}/login`);
                    alert(`Student login created.\nEmail: ${r.email}\nTemporary password: ${r.temporaryPassword}`);
                  }, 'Login created')
                }
              >
                <KeyRound size={16} /> Create login
              </Button>
            )}
            {can('STUDENT_EDIT') && (
              <Button onClick={() => setEdit(true)}>
                <Pencil size={16} /> Edit
              </Button>
            )}
          </>
        }
      />
      <div className="mb-4 grid gap-4 sm:grid-cols-4">
        <Card>
          <p className="text-xs text-slate-500">Attendance (30 days)</p>
          <p className="text-lg font-semibold">
            {(() => {
              const a = s.attendance30d ?? {};
              const t = Object.values(a).reduce((x: any, y: any) => x + y, 0) as number;
              return t ? `${Math.round((((a.PRESENT ?? 0) + (a.LATE ?? 0)) / t) * 100)}%` : '—';
            })()}
          </p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500">Fees balance</p>
          <p className={`text-lg font-semibold ${Number(s.fees?.balance) > 0 ? 'text-red-700' : ''}`}>
            {money(s.fees?.balance, cur)}
          </p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500">Canteen wallet</p>
          <p className="text-lg font-semibold">{money(s.wallet?.balance ?? 0, cur)}</p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500">Latest result</p>
          <p className="text-lg font-semibold">
            {s.latestResult
              ? `${Number(s.latestResult.average).toFixed(1)}% · ${s.latestResult.overallGrade ?? ''}`
              : '—'}
          </p>
        </Card>
      </div>
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'overview', label: 'Overview' },
          { id: 'guardians', label: 'Guardians', count: s.guardians.length },
          { id: 'attendance', label: 'Attendance' },
          ...(has('FEES') ? [{ id: 'fees', label: 'Fees' }] : []),
          ...(has('CANTEEN') ? [{ id: 'wallet', label: 'Wallet' }] : []),
        ]}
      />
      {tab === 'overview' && (
        <Card>
          <Description
            items={[
              ['Date of birth', fmtDate(s.dateOfBirth)],
              ['Gender', title(s.gender)],
              ['Admission date', fmtDate(s.admissionDate)],
              ['House', s.house],
              ['Previous school', s.previousSchool],
              ['Address', s.address],
              [
                'Emergency contact',
                s.emergencyContactName ? `${s.emergencyContactName} · ${s.emergencyContactPhone}` : null,
              ],
              ['Medical notes', s.medicalNotes],
              ['Portal login', s.user ? `${s.user.email} (${s.user.isActive ? 'active' : 'disabled'})` : 'None'],
              ['Record version', s.version],
            ]}
          />
        </Card>
      )}
      {tab === 'guardians' && (
        <Card
          title="Guardians"
          actions={
            can('GUARDIAN_MANAGE') && (
              <Button variant="secondary" onClick={() => setLinkOpen(true)}>
                Link guardian
              </Button>
            )
          }
          padded={false}
        >
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Relationship</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Portal</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {s.guardians.map((l: any) => (
                <tr key={l.guardianId}>
                  <td>
                    <Link
                      href={`/school/guardians?search=${encodeURIComponent(l.guardian.phone)}`}
                      className="text-brand hover:underline"
                    >
                      {l.guardian.firstName} {l.guardian.lastName}
                    </Link>{' '}
                    {l.isPrimary && <Badge tone="brand">Primary</Badge>}
                  </td>
                  <td>{title(l.relationship)}</td>
                  <td>{l.guardian.phone}</td>
                  <td>{l.guardian.email ?? '—'}</td>
                  <td>
                    {l.guardian.user ? (
                      <Badge>ACTIVE</Badge>
                    ) : can('GUARDIAN_MANAGE') ? (
                      <button
                        className="text-xs text-brand hover:underline"
                        onClick={() =>
                          act(async () => {
                            const r = await api.post(`/guardians/${l.guardianId}/login`, {});
                            alert(
                              `Parent login created.\nEmail: ${r.email}\nTemporary password: ${r.temporaryPassword}`,
                            );
                          }, 'Parent login created')
                        }
                      >
                        Create login
                      </button>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    {can('GUARDIAN_MANAGE') && (
                      <button
                        className="text-xs text-red-600 hover:underline"
                        onClick={() =>
                          confirm('Unlink this guardian?') &&
                          act(() => api.delete(`/students/${id}/guardians/${l.guardianId}`), 'Guardian unlinked')
                        }
                      >
                        Unlink
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      {tab === 'attendance' && (
        <Card title="Last 90 days" padded={false}>
          {attendance ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Note</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {attendance.map((a: any) => (
                  <tr key={a.date}>
                    <td>{fmtDate(a.date)}</td>
                    <td>
                      <Badge>{a.status}</Badge>
                    </td>
                    <td>{a.note ?? ''}</td>
                    <td className="text-xs text-slate-500">{a.source}</td>
                  </tr>
                ))}
                {!attendance.length && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-500">
                      No attendance records.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            <Spinner />
          )}
        </Card>
      )}
      {tab === 'fees' &&
        (statement ? (
          <div className="space-y-4">
            <Card
              title="Invoices"
              padded={false}
              actions={
                <>
                  <Button variant="secondary" onClick={() => openBlob(`/documents/students/${id}/statement.pdf`)}>
                    <FileDown size={15} /> Statement PDF
                  </Button>
                  {can('PAYMENT_RECORD') && (
                    <Link href={`/school/fees/payments/new?studentId=${id}`} className="btn-primary">
                      Record payment
                    </Link>
                  )}
                </>
              }
            >
              <table className="table">
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Term</th>
                    <th className="text-right">Total</th>
                    <th className="text-right">Paid</th>
                    <th className="text-right">Balance</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {statement.invoices.map((i: any) => (
                    <tr key={i.id}>
                      <td>
                        <Link href={`/school/fees/invoices/${i.id}`} className="text-brand hover:underline">
                          {i.number}
                        </Link>
                      </td>
                      <td>
                        {i.term?.name} {i.term?.academicYear?.name}
                      </td>
                      <td className="text-right">{money(i.total, cur)}</td>
                      <td className="text-right">{money(i.paidTotal, cur)}</td>
                      <td className="text-right">{money(i.balance, cur)}</td>
                      <td>
                        <Badge>{i.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
            <Card title="Ledger" padded={false}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th className="text-right">Debit</th>
                    <th className="text-right">Credit</th>
                    <th className="text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {statement.ledger.map((l: any) => (
                    <tr key={l.id}>
                      <td className="whitespace-nowrap">{fmtDate(l.createdAt)}</td>
                      <td>{l.description}</td>
                      <td className="text-right">{l.type === 'DEBIT' ? money(l.amount, cur) : ''}</td>
                      <td className="text-right">{l.type === 'CREDIT' ? money(l.amount, cur) : ''}</td>
                      <td className="text-right font-medium">{money(l.balanceAfter, cur)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
        ) : (
          <Spinner />
        ))}
      {tab === 'wallet' &&
        (wallet ? (
          <Card
            title={`Wallet balance: ${money(wallet.wallet.balance, cur)}`}
            padded={false}
            actions={
              <Link href={`/school/canteen/wallets?studentId=${id}`} className="btn-secondary">
                Manage wallet
              </Link>
            }
          >
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th className="text-right">Amount</th>
                  <th className="text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {wallet.wallet.transactions.map((t: any) => (
                  <tr key={t.id}>
                    <td>{fmtDate(t.createdAt)}</td>
                    <td>
                      <Badge tone={t.type === 'PURCHASE' ? 'amber' : 'emerald'}>{t.type}</Badge>
                    </td>
                    <td className="text-right">{money(t.amount, cur)}</td>
                    <td className="text-right">{money(t.balanceAfter, cur)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        ) : (
          <Spinner />
        ))}

      <Modal open={edit} onClose={() => setEdit(false)} title="Edit student" size="xl">
        <StudentForm
          initial={s}
          classes={classes}
          onSubmit={async (body) => {
            const { guardian, ...rest } = body;
            if (!rest.classId) rest.classId = null;
            await act(() => api.patch(`/students/${id}`, rest), 'Student updated');
            setEdit(false);
          }}
        />
      </Modal>
      <Modal
        open={linkOpen}
        onClose={() => setLinkOpen(false)}
        title="Link a guardian"
        footer={
          <>
            <Button variant="secondary" onClick={() => setLinkOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                const body: any = {
                  guardian: {
                    firstName: g.firstName,
                    lastName: g.lastName,
                    phone: g.phone,
                    email: g.email || undefined,
                  },
                  relationship: g.relationship,
                  isPrimary: g.isPrimary,
                };
                await act(() => api.post(`/students/${id}/guardians`, body), 'Guardian linked');
                setLinkOpen(false);
              }}
            >
              Link
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="First name">
            <Input value={g.firstName} onChange={(e) => setG({ ...g, firstName: e.target.value })} />
          </Field>
          <Field label="Last name">
            <Input value={g.lastName} onChange={(e) => setG({ ...g, lastName: e.target.value })} />
          </Field>
          <Field label="Phone" hint="Existing guardians are matched by phone">
            <Input value={g.phone} onChange={(e) => setG({ ...g, phone: e.target.value })} />
          </Field>
          <Field label="Email">
            <Input value={g.email} onChange={(e) => setG({ ...g, email: e.target.value })} />
          </Field>
          <Field label="Relationship">
            <Select
              value={g.relationship}
              onChange={(e) => setG({ ...g, relationship: e.target.value })}
              options={['PARENT', 'FATHER', 'MOTHER', 'GUARDIAN', 'SIBLING', 'OTHER'].map((r) => ({
                value: r,
                label: title(r),
              }))}
            />
          </Field>
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={g.isPrimary}
                onChange={(e) => setG({ ...g, isPrimary: e.target.checked })}
              />{' '}
              Primary contact
            </label>
          </div>
        </div>
      </Modal>
    </div>
  );
}
