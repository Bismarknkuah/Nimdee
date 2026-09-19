'use client';
import Link from 'next/link';
import {
  AlertTriangle,
  BookMarked,
  Briefcase,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  GraduationCap,
  Megaphone,
  MessageSquare,
  RefreshCw,
  Scale,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';
import { useApi } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { ago, fmtDate, fmtDateTime, money, num, pct, title } from '@/lib/format';
import { AttendanceTrend, BarSeries, Donut } from '@/components/charts';
import {
  Badge,
  Card,
  KeyStat,
  PageHeader,
  ProgressBar,
  SectionTitle,
  Spinner,
  StatCard,
  Timeline,
} from '@/components/ui';

/**
 * School administrator dashboard: the whole school on one screen:
 * headline KPIs, attendance, finance, academics, welfare, operations and an action list.
 */
export default function AdminDashboard() {
  const { me, has, can } = useAuth();
  const { data: d, loading } = useApi('/dashboard/school');
  const { data: expenseSummary } = useApi<any>(can('EXPENSE_VIEW') ? '/expenses/summary' : null);
  if (loading || !d) return <Spinner />;
  const cur = me?.tenant?.currency ?? 'GHS';
  const att = d.attendanceToday;
  const attention: Array<{ icon: any; text: string; href: string; tone: string }> = [];
  if (can('EXPENSE_CREATE') && expenseSummary?.rejected.count > 0)
    attention.push({
      icon: AlertTriangle,
      text: `${expenseSummary.rejected.count} recorded expense(s) were rejected — check why`,
      href: '/school/expenses',
      tone: 'text-red-600',
    });
  if (d.counts.pendingAdmissions > 0)
    attention.push({
      icon: UserPlus,
      text: `${d.counts.pendingAdmissions} admission application(s) waiting for review`,
      href: '/school/admissions',
      tone: 'text-sky-600',
    });
  if (att && att.unmarked > 0)
    attention.push({
      icon: ClipboardCheck,
      text: `${att.unmarked} student(s) not yet marked today`,
      href: '/school/attendance?tab=daily',
      tone: 'text-amber-600',
    });
  if (d.fees?.overdueCount > 0)
    attention.push({
      icon: CreditCard,
      text: `${d.fees.overdueCount} invoice(s) overdue · ${money(d.fees.outstanding, cur)} outstanding`,
      href: '/school/fees?status=OVERDUE',
      tone: 'text-red-600',
    });
  if (d.results?.SUBMITTED > 0)
    attention.push({
      icon: GraduationCap,
      text: `${d.results.SUBMITTED} result sheet(s) awaiting review`,
      href: '/school/results/sheets',
      tone: 'text-sky-600',
    });
  if (d.openIncidents > 0)
    attention.push({
      icon: Scale,
      text: `${d.openIncidents} open discipline incident(s)`,
      href: '/school/discipline?status=OPEN',
      tone: 'text-red-600',
    });
  if (d.pendingLeave > 0)
    attention.push({
      icon: Briefcase,
      text: `${d.pendingLeave} leave request(s) to approve`,
      href: '/school/hr',
      tone: 'text-amber-600',
    });
  if (d.overdueLoans > 0)
    attention.push({
      icon: BookMarked,
      text: `${d.overdueLoans} overdue library book(s)`,
      href: '/school/library',
      tone: 'text-amber-600',
    });
  if (d.sync.openConflicts > 0)
    attention.push({
      icon: RefreshCw,
      text: `${d.sync.openConflicts} sync conflict(s) need a decision`,
      href: '/school/sync',
      tone: 'text-red-600',
    });
  if (d.unreadMessages > 0)
    attention.push({
      icon: MessageSquare,
      text: `${d.unreadMessages} unread conversation(s)`,
      href: '/school/messages',
      tone: 'text-sky-600',
    });
  const quick = [
    { href: '/school/students/new', label: 'Enrol student', icon: UserPlus, perm: 'STUDENT_CREATE' },
    { href: '/school/attendance', label: 'Attendance', icon: ClipboardCheck, feature: 'ATTENDANCE' },
    {
      href: '/school/fees/payments/new',
      label: 'Record payment',
      icon: Wallet,
      perm: 'PAYMENT_RECORD',
      feature: 'FEES',
    },
    { href: '/school/announcements', label: 'Announce', icon: Megaphone, feature: 'COMMUNICATIONS' },
    { href: '/school/events', label: 'Calendar', icon: CalendarDays, feature: 'EVENTS' },
    { href: '/school/results/sheets', label: 'Results', icon: GraduationCap, feature: 'RESULTS' },
    { href: '/school/assignments', label: 'Homework', icon: ClipboardList, feature: 'ASSIGNMENTS' },
    { href: '/school/staff', label: 'Staff', icon: Users },
    { href: '/school/settings?tab=data', label: 'Backup data', icon: RefreshCw, perm: 'SCHOOL_MANAGE' },
  ].filter((q) => (!q.perm || can(q.perm)) && (!q.feature || has(q.feature)));
  return (
    <div>
      <PageHeader
        title={`Good day, ${me?.user.firstName}`}
        subtitle={
          d.term
            ? `${d.term.year} · ${d.term.name} · ${fmtDate(d.term.startDate)} – ${fmtDate(d.term.endDate)}`
            : 'No current term configured. Set one under Academics'
        }
        actions={
          <span className="text-xs text-slate-500">
            {d.school.plan} plan · <Badge>{d.school.subscriptionStatus}</Badge>
          </span>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <StatCard
          label="Active students"
          value={num(d.counts.students)}
          hint={`${d.counts.byGender?.MALE ?? 0} boys · ${d.counts.byGender?.FEMALE ?? 0} girls`}
          icon={<GraduationCap size={20} />}
        />
        <StatCard
          label="Attendance today"
          value={att ? pct(att.rate) : '—'}
          hint={att ? `${att.marked}/${att.enrolled} marked · ${att.ABSENT} absent` : 'Module off'}
          icon={<ClipboardCheck size={20} />}
          tone="emerald"
        />
        <StatCard
          label="Fees collected"
          value={d.fees ? money(d.fees.collected, cur) : '—'}
          hint={d.fees ? `${pct(d.fees.collectionRate)} of ${money(d.fees.invoiced, cur)}` : 'Module off'}
          icon={<CreditCard size={20} />}
          tone="amber"
        />
        <StatCard
          label="Outstanding"
          value={d.fees ? money(d.fees.outstanding, cur) : '—'}
          hint={d.fees ? `${d.fees.overdueCount} overdue · today ${money(d.fees.today, cur)}` : ''}
          icon={<AlertTriangle size={20} />}
          tone="red"
        />
        <StatCard
          label="Staff"
          value={num(d.counts.staff)}
          hint={`${d.counts.classes} classes · ${d.staffOnLeave} on leave today`}
          icon={<Users size={20} />}
          tone="violet"
        />
        <StatCard
          label="Guardians"
          value={num(d.counts.parents)}
          hint={`${d.dueAssignments} assignments due this week`}
          icon={<Users size={20} />}
          tone="sky"
        />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <Card title="Attendance: last 7 days" className="lg:col-span-2">
          {d.attendanceTrend?.length ? (
            <AttendanceTrend data={d.attendanceTrend} />
          ) : (
            <p className="py-8 text-center text-sm text-slate-500">
              No attendance recorded yet. Teachers mark it under Attendance (works offline).
            </p>
          )}
        </Card>
        <Card title="Needs attention" padded={false}>
          {attention.length ? (
            <ul className="divide-y divide-slate-100">
              {attention.map((a, i) => (
                <li key={i}>
                  <Link href={a.href} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-50">
                    <a.icon size={16} className={a.tone} />
                    <span className="flex-1">{a.text}</span>
                    <span className="text-slate-400">›</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-6 text-center text-sm text-slate-500">
              All clear, nothing needs your attention right now.
            </p>
          )}
        </Card>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <Card title="Attendance by class (today)" className="lg:col-span-2" padded={false}>
          {att?.classes?.length ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Class</th>
                  <th className="w-40">Marked</th>
                  <th className="text-right">Present</th>
                  <th className="text-right">Absent</th>
                  <th className="text-right">Late</th>
                  <th className="text-right">Rate</th>
                </tr>
              </thead>
              <tbody>
                {att.classes.map((c: any) => {
                  const rate = c.marked ? Math.round(((c.PRESENT + c.LATE) / c.marked) * 100) : null;
                  return (
                    <tr key={c.classId}>
                      <td>
                        <Link
                          href={`/school/attendance?classId=${c.classId}`}
                          className="font-medium text-brand hover:underline"
                        >
                          {c.name}
                        </Link>
                      </td>
                      <td>
                        <ProgressBar
                          value={c.enrolled ? Math.round((c.marked / c.enrolled) * 100) : 0}
                          tone={c.marked === c.enrolled ? 'emerald' : 'amber'}
                          label={`${c.marked}/${c.enrolled}`}
                        />
                      </td>
                      <td className="text-right">{c.PRESENT}</td>
                      <td className="text-right text-red-700">{c.ABSENT}</td>
                      <td className="text-right text-amber-700">{c.LATE}</td>
                      <td className="text-right font-medium">{rate === null ? '—' : `${rate}%`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p className="p-6 text-center text-sm text-slate-500">No classes yet.</p>
          )}
        </Card>
        <Card title="Today by status">
          {att && att.marked ? (
            <Donut
              data={['PRESENT', 'ABSENT', 'LATE', 'EXCUSED', 'SICK']
                .map((k) => ({ name: title(k), value: att[k] }))
                .filter((x) => x.value)}
            />
          ) : (
            <p className="py-8 text-center text-sm text-slate-500">Nothing marked today.</p>
          )}
        </Card>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <Card
          title="Upcoming events"
          padded={false}
          actions={
            has('EVENTS') && (
              <Link href="/school/events" className="text-xs text-brand hover:underline">
                Calendar
              </Link>
            )
          }
        >
          <div className="p-4">
            <Timeline
              items={(d.upcomingEvents ?? []).map((e: any) => ({
                id: e.id,
                title: e.title,
                meta: `${e.allDay ? fmtDate(e.startAt) : fmtDateTime(e.startAt)}${e.location ? ` · ${e.location}` : ''}`,
                tone:
                  { HOLIDAY: 'emerald', EXAM: 'red', MEETING: 'sky', SPORTS: 'amber', TRIP: 'violet' }[
                    e.type as string
                  ] ?? 'brand',
              }))}
            />
          </div>
        </Card>
        <Card title="Results this term">
          {Object.keys(d.results ?? {}).length ? (
            <BarSeries
              data={Object.entries(d.results).map(([k, v]) => ({ status: title(k), sheets: v }))}
              x="status"
              bars={[{ key: 'sheets', name: 'Result sheets' }]}
              height={200}
            />
          ) : (
            <p className="py-8 text-center text-sm text-slate-500">No results computed yet this term.</p>
          )}
        </Card>
        <Card title="Operations">
          <div className="grid grid-cols-2 gap-3">
            <KeyStat
              label="Offline devices"
              value={d.sync.devices}
              sub={`${d.sync.pendingOperations} pending · ${d.sync.offlineDevices} offline >24h`}
            />
            <KeyStat
              label="Sync conflicts"
              value={d.sync.openConflicts}
              tone={d.sync.openConflicts ? 'red' : 'emerald'}
            />
            <KeyStat
              label="Behaviour"
              value={d.openIncidents}
              sub="open incidents"
              tone={d.openIncidents ? 'amber' : 'emerald'}
            />
            <KeyStat
              label="Library"
              value={d.overdueLoans}
              sub="overdue books"
              tone={d.overdueLoans ? 'amber' : 'emerald'}
            />
            <KeyStat
              label="HR"
              value={d.pendingLeave}
              sub="leave requests pending"
              tone={d.pendingLeave ? 'amber' : 'emerald'}
            />
          </div>
        </Card>
      </div>

      <SectionTitle>Quick actions</SectionTitle>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-9">
        {quick.map((q) => (
          <Link
            key={q.href}
            href={q.href}
            className="card flex flex-col items-center gap-2 p-3 text-center text-xs font-medium text-slate-700 hover:border-brand hover:text-brand-dark"
          >
            <q.icon size={20} className="text-brand" />
            {q.label}
          </Link>
        ))}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Card
          title="Latest announcements"
          padded={false}
          actions={
            <Link href="/school/announcements" className="text-xs text-brand hover:underline">
              All
            </Link>
          }
        >
          <ul className="divide-y divide-slate-100 text-sm">
            {d.announcements.map((a: any) => (
              <li key={a.id} className="flex items-center justify-between px-4 py-2">
                <span className="font-medium">{a.title}</span>
                <span className="text-xs text-slate-500">
                  {title(a.audienceType)} · {ago(a.publishedAt)}
                </span>
              </li>
            ))}
            {!d.announcements.length && <li className="px-4 py-6 text-center text-slate-500">No announcements yet</li>}
          </ul>
        </Card>
        <Card
          title="Recent activity"
          padded={false}
          actions={
            <Link href="/school/audit" className="text-xs text-brand hover:underline">
              Audit log
            </Link>
          }
        >
          <ul className="divide-y divide-slate-100 text-sm">
            {d.recentAudit.map((a: any) => (
              <li key={a.id} className="flex items-center justify-between px-4 py-2">
                <span>
                  <Badge tone="slate">{title(a.action)}</Badge> <span className="text-slate-500">{a.entity}</span>
                </span>
                <span className="text-xs text-slate-500">
                  {a.actorName} · {ago(a.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
