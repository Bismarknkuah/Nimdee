'use client';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { BookMarked, Bus, CheckCircle2, CreditCard, FileDown, HeartPulse } from 'lucide-react';
import { api, openBlob, qs } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { DAYS, fmtDate, fmtDateTime, money, title } from '@/lib/format';
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  Field,
  Input,
  Modal,
  PageHeader,
  Spinner,
  Tabs,
  Timeline,
  useToast,
} from '@/components/ui';

/** Parent / student view of one child: attendance, results, fees (with online payment), timetable, wallet. */
function Child() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const { me, has, role } = useAuth();
  const cur = me?.tenant?.currency ?? 'GHS';
  const [tab, setTab] = useState(params.get('tab') ?? 'attendance');
  const { data: child, loading } = useApi(`/portal/children/${id}`);
  const attendance = useApi(tab === 'attendance' ? `/portal/children/${id}/attendance` : null, [tab]);
  const results = useApi(tab === 'results' ? `/portal/children/${id}/results` : null, [tab]);
  const fees = useApi(tab === 'fees' ? `/portal/children/${id}/fees` : null, [tab]);
  const timetable = useApi(tab === 'timetable' ? `/portal/children/${id}/timetable` : null, [tab]);
  const wallet = useApi(tab === 'wallet' ? `/portal/children/${id}/wallet` : null, [tab]);
  const assignments = useApi(tab === 'assignments' ? `/portal/children/${id}/assignments` : null, [tab]);
  const discipline = useApi(tab === 'discipline' ? `/portal/children/${id}/discipline` : null, [tab]);
  const health = useApi(tab === 'health' ? `/portal/children/${id}/health` : null, [tab]);
  const transport = useApi(tab === 'transport' ? `/portal/children/${id}/transport` : null, [tab]);
  const library = useApi(tab === 'library' ? `/portal/children/${id}/library` : null, [tab]);
  const events = useApi(tab === 'events' ? `/portal/children/${id}/events` : null, [tab]);
  const submit = async (assignmentId: string) => {
    try {
      await api.post(`/portal/children/${id}/assignments/${assignmentId}/submit`, {});
      toast.success('Marked as submitted');
      assignments.reload();
    } catch (e: any) {
      toast.error(e.message);
    }
  };
  const [pay, setPay] = useState<any>(null);
  const [amount, setAmount] = useState('');
  const [email, setEmail] = useState(me?.user?.email ?? '');
  const [busy, setBusy] = useState(false);
  if (loading || !child) return <Spinner />;
  const startPay = async (purpose: 'FEES' | 'WALLET') => {
    setBusy(true);
    try {
      const r = await api.post('/portal/payments/initiate', {
        studentId: id,
        invoiceId: pay?.invoiceId,
        amount: Number(amount),
        email,
        purpose,
        callbackUrl: `${window.location.origin}/pay/callback`,
      });
      window.location.href = r.authorizationUrl;
    } catch (e: any) {
      toast.error(
        e.code === 'PAYMENTS_NOT_CONFIGURED'
          ? 'Online payments are not enabled by the school yet. Please pay at the school office.'
          : e.message,
      );
      setBusy(false);
    }
  };
  const grouped = (timetable.data ?? []).reduce(
    (a: any, s: any) => ({ ...a, [s.dayOfWeek]: [...(a[s.dayOfWeek] ?? []), s] }),
    {},
  );
  return (
    <div>
      <PageHeader
        back={() => router.push('/school')}
        title={
          <span className="flex items-center gap-3">
            <Avatar name={`${child.firstName} ${child.lastName}`} src={child.photoUrl} size="lg" />
            {child.firstName} {child.lastName}
          </span>
        }
        subtitle={`${child.studentId} · ${child.class?.name ?? ''}${child.class?.classTeacher ? ` · Class teacher ${child.class.classTeacher.firstName} ${child.class.classTeacher.lastName}` : ''}`}
      />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'attendance', label: 'Attendance' },
          ...(has('RESULTS') ? [{ id: 'results', label: 'Results' }] : []),
          ...(has('FEES') && role === 'parent' ? [{ id: 'fees', label: 'Fees' }] : []),
          ...(has('TIMETABLE') ? [{ id: 'timetable', label: 'Timetable' }] : []),
          ...(has('ASSIGNMENTS') ? [{ id: 'assignments', label: 'Homework' }] : []),
          ...(has('CANTEEN') ? [{ id: 'wallet', label: 'Canteen wallet' }] : []),
          ...(has('DISCIPLINE') ? [{ id: 'discipline', label: 'Behaviour' }] : []),
          ...(has('HEALTH') ? [{ id: 'health', label: 'Health' }] : []),
          ...(has('TRANSPORT') ? [{ id: 'transport', label: 'Transport' }] : []),
          ...(has('LIBRARY') ? [{ id: 'library', label: 'Library' }] : []),
          ...(has('EVENTS') ? [{ id: 'events', label: 'Events' }] : []),
        ]}
      />
      {tab === 'attendance' &&
        (attendance.data ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {['PRESENT', 'ABSENT', 'LATE', 'EXCUSED', 'SICK'].map((k) => (
                <Card key={k}>
                  <p className="text-xs text-slate-500">{title(k)}</p>
                  <p className="text-xl font-semibold">{attendance.data.counts[k]}</p>
                </Card>
              ))}
            </div>
            <p className="text-sm text-slate-600">
              Attendance rate (last 90 days): <b>{attendance.data.rate ?? '—'}%</b>
            </p>
            <Card padded={false}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {attendance.data.history.map((h: any) => (
                    <tr key={h.date}>
                      <td>{fmtDate(h.date)}</td>
                      <td>
                        <Badge>{h.status}</Badge>
                      </td>
                      <td>{h.note ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>
        ) : (
          <Spinner />
        ))}
      {tab === 'results' &&
        (results.data ? (
          results.data.length ? (
            <div className="space-y-4">
              {results.data.map((s: any) => (
                <Card
                  key={s.id}
                  title={`${s.term.name} · ${s.term.academicYear.name}`}
                  actions={
                    <Button
                      variant="secondary"
                      onClick={() => openBlob(`/portal/children/${id}/results/${s.id}/report-card.pdf`)}
                    >
                      <FileDown size={15} /> Report card
                    </Button>
                  }
                >
                  <div className="mb-3 flex flex-wrap gap-4 text-sm">
                    <span>
                      Average <b>{Number(s.average).toFixed(1)}%</b>
                    </span>
                    <span>
                      Grade <b>{s.overallGrade ?? '—'}</b>
                    </span>
                    <span>
                      Position{' '}
                      <b>
                        {s.position ?? '—'} / {s.classSize}
                      </b>
                    </span>
                    <span>
                      Attendance{' '}
                      <b>
                        {s.attendancePresent}/{s.attendanceTotal}
                      </b>
                    </span>
                    {s.promotionStatus && <Badge tone="brand">{s.promotionStatus}</Badge>}
                  </div>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Subject</th>
                        <th className="text-right">Class</th>
                        <th className="text-right">Exam</th>
                        <th className="text-right">Total</th>
                        <th>Grade</th>
                        <th>Remark</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.subjects
                        .filter((x: any) => x.hasMarks)
                        .map((x: any) => (
                          <tr key={x.subjectId}>
                            <td>{x.name}</td>
                            <td className="text-right">{x.ca}</td>
                            <td className="text-right">{x.exam}</td>
                            <td className="text-right font-medium">{x.total}</td>
                            <td>{x.grade}</td>
                            <td>{x.remark}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                  {(s.classTeacherComment || s.headComment) && (
                    <div className="mt-3 space-y-1 text-sm">
                      {s.classTeacherComment && (
                        <p>
                          <b>Class teacher:</b> {s.classTeacherComment}
                        </p>
                      )}
                      {s.headComment && (
                        <p>
                          <b>Head teacher:</b> {s.headComment}
                        </p>
                      )}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          ) : (
            <Alert kind="info">No published results yet.</Alert>
          )
        ) : (
          <Spinner />
        ))}
      {tab === 'fees' &&
        (fees.data ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-4">
              <Card>
                <p className="text-xs text-slate-500">Outstanding balance</p>
                <p
                  className={`text-2xl font-semibold ${Number(fees.data.balance) > 0 ? 'text-red-700' : 'text-emerald-700'}`}
                >
                  {money(fees.data.balance, cur)}
                </p>
              </Card>
              {Number(fees.data.balance) > 0 && (
                <Button
                  onClick={() => {
                    const inv = fees.data.invoices.find((i: any) => Number(i.balance) > 0);
                    setPay({ invoiceId: inv?.id });
                    setAmount(String(Number(inv?.balance ?? fees.data.balance)));
                  }}
                >
                  <CreditCard size={16} /> Pay online
                </Button>
              )}
            </div>
            <Card title="Invoices" padded={false}>
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
                  {fees.data.invoices.map((i: any) => (
                    <tr key={i.id}>
                      <td>{i.number}</td>
                      <td>{i.term?.name}</td>
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
            <Card title="Payments" padded={false}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Receipt</th>
                    <th>Date</th>
                    <th>Method</th>
                    <th className="text-right">Amount</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {fees.data.payments.map((p: any) => (
                    <tr key={p.id}>
                      <td>{p.receiptNumber ?? <Badge>{p.status}</Badge>}</td>
                      <td>{fmtDateTime(p.paidAt)}</td>
                      <td>{title(p.method)}</td>
                      <td className="text-right">{money(p.amount, cur)}</td>
                      <td>
                        {p.status === 'SUCCESS' && (
                          <button
                            className="text-xs text-brand hover:underline"
                            onClick={() => openBlob(`/portal/payments/${p.id}/receipt.pdf`)}
                          >
                            Receipt
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!fees.data.payments.length && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-500">
                        No payments yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </Card>
          </div>
        ) : (
          <Spinner />
        ))}
      {tab === 'timetable' &&
        (timetable.data ? (
          <div className="grid gap-3 md:grid-cols-5">
            {[1, 2, 3, 4, 5].map((d) => (
              <Card key={d} title={DAYS[d]} padded={false}>
                <ul className="divide-y divide-slate-100 text-sm">
                  {(grouped[d] ?? []).map((s: any) => (
                    <li key={s.id} className="px-3 py-2">
                      <p className="font-medium">{s.subject.name}</p>
                      <p className="text-xs text-slate-500">
                        {s.period.startTime}–{s.period.endTime}
                        {s.teacher ? ` · ${s.teacher.firstName} ${s.teacher.lastName}` : ''}
                      </p>
                    </li>
                  ))}
                  {!(grouped[d] ?? []).length && <li className="px-3 py-3 text-xs text-slate-400">No lessons</li>}
                </ul>
              </Card>
            ))}
          </div>
        ) : (
          <Spinner />
        ))}
      {tab === 'wallet' &&
        (wallet.data ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-4">
              <Card>
                <p className="text-xs text-slate-500">Wallet balance</p>
                <p className="text-2xl font-semibold">{money(wallet.data.wallet.balance, cur)}</p>
                <p className="text-xs text-slate-500">Spent today {money(wallet.data.spentToday, cur)}</p>
              </Card>
              {role === 'parent' && (
                <Button
                  onClick={() => {
                    setPay({ wallet: true });
                    setAmount('50');
                  }}
                >
                  <CreditCard size={16} /> Top up online
                </Button>
              )}
            </div>
            <Card padded={false}>
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
                  {wallet.data.wallet.transactions.map((t: any) => (
                    <tr key={t.id}>
                      <td>{fmtDateTime(t.createdAt)}</td>
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
          </div>
        ) : (
          <Spinner />
        ))}
      {tab === 'assignments' &&
        (assignments.data ? (
          <Card padded={false}>
            {assignments.data.length ? (
              <ul className="divide-y divide-slate-100">
                {assignments.data.map((a: any) => (
                  <li key={a.id} className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-slate-900">
                          {a.title} <Badge tone="slate">{a.subject}</Badge>
                        </p>
                        <p className="mt-0.5 text-sm text-slate-600 whitespace-pre-line">{a.instructions}</p>
                        <p className={`mt-1 text-xs ${a.overdue ? 'text-red-700' : 'text-slate-500'}`}>
                          Due {fmtDateTime(a.dueAt)}
                          {a.overdue ? ' · overdue' : ''}
                          {a.maxScore ? ` · out of ${Number(a.maxScore)}` : ''}
                        </p>
                        {a.feedback && (
                          <p className="mt-1 rounded bg-emerald-50 px-2 py-1 text-xs text-emerald-800">
                            Teacher: {a.feedback}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <Badge>{a.status}</Badge>
                        {a.score !== null && a.score !== undefined && (
                          <p className="mt-1 text-lg font-semibold">
                            {Number(a.score)}
                            {a.maxScore ? `/${Number(a.maxScore)}` : ''}
                          </p>
                        )}
                        {a.status === 'PENDING' && (
                          <Button variant="secondary" className="mt-2" onClick={() => submit(a.assignmentId)}>
                            <CheckCircle2 size={14} /> Mark done
                          </Button>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="p-6 text-center text-sm text-slate-500">No homework assigned yet.</p>
            )}
          </Card>
        ) : (
          <Spinner />
        ))}
      {tab === 'discipline' &&
        (discipline.data ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-4">
              <Card>
                <p className="text-xs text-slate-500">Demerit points</p>
                <p className="text-2xl font-semibold">{discipline.data.totalPoints}</p>
              </Card>
              <Card>
                <p className="text-xs text-slate-500">Open</p>
                <p className="text-2xl font-semibold">{discipline.data.open}</p>
              </Card>
              <Card>
                <p className="text-xs text-slate-500">Minor / moderate / serious</p>
                <p className="text-2xl font-semibold">
                  {discipline.data.bySeverity.MINOR} / {discipline.data.bySeverity.MODERATE} /{' '}
                  {discipline.data.bySeverity.SERIOUS}
                </p>
              </Card>
            </div>
            <Card padded={false}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Category</th>
                    <th>Severity</th>
                    <th>Description</th>
                    <th>Action</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {discipline.data.incidents.map((i: any) => (
                    <tr key={i.id}>
                      <td>{fmtDate(i.date)}</td>
                      <td>{title(i.category)}</td>
                      <td>
                        <Badge tone={i.severity === 'SERIOUS' ? 'red' : i.severity === 'MODERATE' ? 'amber' : 'slate'}>
                          {i.severity}
                        </Badge>
                      </td>
                      <td>{i.description}</td>
                      <td>{i.actionTaken ?? '—'}</td>
                      <td>
                        <Badge>{i.status}</Badge>
                      </td>
                    </tr>
                  ))}
                  {!discipline.data.incidents.length && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-500">
                        No behaviour incidents. Well done!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </Card>
          </div>
        ) : (
          <Spinner />
        ))}
      {tab === 'health' &&
        (health.data ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card
              title={
                <span className="flex items-center gap-2">
                  <HeartPulse size={16} /> Health summary
                </span>
              }
            >
              {health.data.record ? (
                <dl className="space-y-2 text-sm">
                  <div>
                    <dt className="text-xs text-slate-500">Blood group</dt>
                    <dd>{health.data.record.bloodGroup ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Allergies</dt>
                    <dd>{health.data.record.allergies ?? 'None recorded'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Conditions</dt>
                    <dd>{health.data.record.conditions ?? 'None recorded'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Medications</dt>
                    <dd>{health.data.record.medications ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Immunizations</dt>
                    <dd>
                      {Array.isArray(health.data.record.immunizations) && health.data.record.immunizations.length
                        ? health.data.record.immunizations
                            .map((i: any) => `${i.name}${i.date ? ` (${i.date})` : ''}`)
                            .join(', ')
                        : '—'}
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="text-sm text-slate-500">
                  The school has not recorded health details yet. Please share allergies and conditions with the school
                  office.
                </p>
              )}
            </Card>
            <Card title="Clinic visits" padded={false}>
              <table className="table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Type</th>
                    <th>Complaint</th>
                    <th>Treatment</th>
                  </tr>
                </thead>
                <tbody>
                  {health.data.visits.map((v: any) => (
                    <tr key={v.id}>
                      <td>{fmtDateTime(v.date)}</td>
                      <td>
                        <Badge>{v.type}</Badge>
                        {v.referredOut && (
                          <Badge tone="red" className="ml-1">
                            Referred
                          </Badge>
                        )}
                      </td>
                      <td>{v.complaint}</td>
                      <td>{v.treatment ?? '—'}</td>
                    </tr>
                  ))}
                  {!health.data.visits.length && (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-slate-500">
                        No clinic visits
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </Card>
          </div>
        ) : (
          <Spinner />
        ))}
      {tab === 'transport' &&
        (transport.data === null || transport.data === undefined ? (
          transport.loading ? (
            <Spinner />
          ) : (
            <Card>
              <p className="py-6 text-center text-sm text-slate-500">Not registered on a school bus route.</p>
            </Card>
          )
        ) : (
          <Card
            title={
              <span className="flex items-center gap-2">
                <Bus size={16} /> {transport.data.route.name}
              </span>
            }
          >
            <dl className="grid gap-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs text-slate-500">Vehicle</dt>
                <dd>{transport.data.route.vehicle ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Driver</dt>
                <dd>
                  {transport.data.route.driverName ?? '—'}
                  {transport.data.route.driverPhone ? ` · ${transport.data.route.driverPhone}` : ''}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Your stop</dt>
                <dd>
                  {transport.data.stop
                    ? `${transport.data.stop.name} · pick-up ${transport.data.stop.pickupTime ?? '—'} · drop-off ${transport.data.stop.dropoffTime ?? '—'}`
                    : 'Any stop'}
                </dd>
              </div>
            </dl>
            <p className="mt-3 text-xs font-medium text-slate-500">All stops</p>
            <ol className="mt-1 list-decimal pl-5 text-sm">
              {transport.data.route.stops.map((s: any) => (
                <li key={s.id}>
                  {s.name}{' '}
                  <span className="text-slate-500">
                    ({s.pickupTime ?? '—'} / {s.dropoffTime ?? '—'})
                  </span>
                </li>
              ))}
            </ol>
          </Card>
        ))}
      {tab === 'library' &&
        (library.data ? (
          <Card
            title={
              <span className="flex items-center gap-2">
                <BookMarked size={16} /> Books borrowed
              </span>
            }
            padded={false}
          >
            <table className="table">
              <thead>
                <tr>
                  <th>Book</th>
                  <th>Borrowed</th>
                  <th>Due</th>
                  <th>Status</th>
                  <th className="text-right">Fine</th>
                </tr>
              </thead>
              <tbody>
                {library.data.map((l: any) => (
                  <tr key={l.id}>
                    <td className="font-medium">
                      {l.book.title} <span className="text-xs text-slate-500">{l.book.author}</span>
                    </td>
                    <td>{fmtDate(l.borrowedAt)}</td>
                    <td>{fmtDate(l.dueAt)}</td>
                    <td>
                      <Badge>{l.status}</Badge>
                    </td>
                    <td className="text-right">{Number(l.fine) ? money(l.fine, cur) : '—'}</td>
                  </tr>
                ))}
                {!library.data.length && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-500">
                      No library loans
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
        ) : (
          <Spinner />
        ))}
      {tab === 'events' &&
        (events.data ? (
          <Card title="Upcoming school events">
            <Timeline
              items={events.data
                .filter((e: any) => new Date(e.endAt) >= new Date())
                .map((e: any) => ({
                  id: e.id,
                  title: e.title,
                  meta: `${e.allDay ? fmtDate(e.startAt) : fmtDateTime(e.startAt)}${e.location ? ` · ${e.location}` : ''}`,
                  tone:
                    { HOLIDAY: 'emerald', EXAM: 'red', MEETING: 'sky', SPORTS: 'amber', TRIP: 'violet' }[
                      e.type as string
                    ] ?? 'brand',
                  body: e.description,
                }))}
            />
          </Card>
        ) : (
          <Spinner />
        ))}
      <Modal
        open={!!pay}
        onClose={() => setPay(null)}
        title={pay?.wallet ? 'Top up canteen wallet' : 'Pay school fees online'}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPay(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => startPay(pay?.wallet ? 'WALLET' : 'FEES')}
              loading={busy}
              disabled={!amount || !email}
            >
              Continue to payment
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label={`Amount (${cur})`}>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label="Email for receipt">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <p className="text-xs text-slate-500">
            You will be redirected to Paystack to pay with Mobile Money or card. A receipt is issued automatically.
          </p>
        </div>
      </Modal>
    </div>
  );
}
export default function ChildPage() {
  return (
    <Suspense>
      <Child />
    </Suspense>
  );
}
