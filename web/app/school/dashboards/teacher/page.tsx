'use client';
import Link from 'next/link';
import { useState } from 'react';
import {
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Clock,
  FileBarChart,
  MessageSquare,
  Scale,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useApi } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { fmtDate, fmtDateTime, title } from '@/lib/format';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  KeyStat,
  Modal,
  PageHeader,
  ProgressBar,
  SectionTitle,
  Spinner,
  StatCard,
  Timeline,
  useToast,
} from '@/components/ui';

const STATUSES = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED', 'SICK'];
const STATUS_CLASS: Record<string, string> = {
  PRESENT: 'bg-emerald-600 text-white',
  ABSENT: 'bg-red-600 text-white',
  LATE: 'bg-amber-500 text-white',
  EXCUSED: 'bg-sky-600 text-white',
  SICK: 'bg-violet-600 text-white',
};

/** Marks attendance for one specific lesson (a timetable slot today) — separate from the class
 *  teacher's daily homeroom attendance elsewhere on this page. */
function LessonAttendanceModal({ slotId, onClose, onDone }: { slotId: string; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const today = new Date().toISOString().slice(0, 10);
  const { data, loading, reload } = useApi<any>(`/attendance/lessons/${slotId}/roster?date=${today}`, [slotId]);
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const current = (studentId: string) => statuses[studentId] ?? data?.students.find((s: any) => s.id === studentId)?.status ?? 'PRESENT';
  const submit = async () => {
    if (!data) return;
    setBusy(true);
    try {
      const records = data.students.map((s: any) => ({ studentId: s.id, status: current(s.id) }));
      await api.post('/attendance/lessons/mark', { timetableSlotId: slotId, date: today, records });
      toast.success('Lesson attendance saved');
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
      title={data ? `${data.slot.subject.name} — ${data.slot.class.name}` : 'Lesson attendance'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy}>
            Save attendance
          </Button>
        </>
      }
    >
      {loading || !data ? (
        <Spinner />
      ) : (
        <div className="max-h-[60vh] space-y-1 overflow-y-auto">
          {data.students.map((s: any) => (
            <div key={s.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 p-2">
              <p className="text-sm font-medium text-slate-800">
                {s.firstName} {s.lastName}
              </p>
              <div className="flex gap-1">
                {STATUSES.map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatuses({ ...statuses, [s.id]: st })}
                    className={`rounded-md px-2 py-1 text-[11px] font-semibold ${
                      current(s.id) === st ? STATUS_CLASS[st] : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {st.slice(0, 3)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

/** Teacher dashboard: classes, lessons, attendance, homework, results, behaviour and messages. */
export default function TeacherDashboard() {
  const { me, has, can } = useAuth();
  const { data: d, loading } = useApi('/dashboard/teacher');
  const { data: msg } = useApi(has('MESSAGING') ? '/messages/unread-count' : null);
  const { data: myLessons, reload: reloadLessons } = useApi<any[]>(
    can('ATTENDANCE_MARK') ? '/attendance/my-lessons-today' : null,
  );
  const [markingSlot, setMarkingSlot] = useState<string | null>(null);
  if (loading || !d) return <Spinner />;
  const unmarked = d.classTeacherOf.filter((c: any) => !c.attendanceMarkedToday);
  const toGrade = (d.assignmentsDue ?? []).reduce((n: number, a: any) => n + a.toGrade, 0);
  return (
    <div>
      <PageHeader
        title={`Hello, ${me?.user.firstName}`}
        subtitle={
          d.term
            ? `${d.term.name} · ${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}`
            : undefined
        }
        actions={
          <>
            <Link href="/school/attendance" className="btn-primary">
              <ClipboardCheck size={16} /> Mark attendance
            </Link>
            {has('ASSIGNMENTS') && (
              <Link href="/school/assignments" className="btn-secondary">
                <ClipboardList size={16} /> Homework
              </Link>
            )}
          </>
        }
      />
      <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="My classes"
          value={d.classTeacherOf.length}
          hint="as class teacher"
          icon={<ClipboardCheck size={20} />}
        />
        <StatCard
          label="Subjects"
          value={d.teaching.length}
          hint={`in ${new Set(d.teaching.map((t: any) => t.classId)).size} classes`}
          icon={<FileBarChart size={20} />}
          tone="violet"
        />
        <StatCard
          label="Lessons today"
          value={d.today.length}
          hint={d.today[0] ? `Next: ${d.today[0].subject} ${d.today[0].time}` : 'No lessons scheduled'}
          icon={<Clock size={20} />}
          tone="emerald"
        />
        <StatCard
          label="To grade"
          value={toGrade}
          hint="submitted homework"
          icon={<ClipboardList size={20} />}
          tone="amber"
        />
        <StatCard
          label="Open incidents"
          value={d.openIncidents ?? 0}
          hint="in my classes"
          icon={<Scale size={20} />}
          tone="red"
        />
        <StatCard
          label="Unread messages"
          value={msg?.count ?? 0}
          hint="from parents & staff"
          icon={<MessageSquare size={20} />}
          tone="sky"
        />
      </div>
      {unmarked.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Attendance not yet marked today for <b>{unmarked.map((c: any) => c.name).join(', ')}</b>.{' '}
          <Link href={`/school/attendance?classId=${unmarked[0].id}`} className="font-semibold underline">
            Mark now
          </Link>.{' '}
          It works even without internet.
        </div>
      )}
      {d.pendingLeave && (
        <div className="mt-2 rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-800">
          Your {title(d.pendingLeave.type)} leave request ({d.pendingLeave.days} days from{' '}
          {fmtDate(d.pendingLeave.startDate)}) is awaiting approval.
        </div>
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        {myLessons && myLessons.length > 0 && (
          <Card title="Today's lessons" padded={false} className="lg:col-span-3">
            <p className="border-b border-slate-100 px-4 py-2 text-xs text-slate-500">
              Attendance for each lesson is separate from daily homeroom attendance above.
            </p>
            <ul className="divide-y divide-slate-100">
              {myLessons.map((l: any) => (
                <li key={l.id} className="flex items-center justify-between px-4 py-2.5">
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {l.period.name} · {l.subject.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {l.class.name} ({title(l.class.level)}) · {l.period.startTime}–{l.period.endTime}
                    </p>
                  </div>
                  {l.marked ? (
                    <span className="flex items-center gap-1 text-sm text-emerald-700">
                      <CheckCircle2 size={16} /> Marked
                    </span>
                  ) : (
                    <Button variant="secondary" onClick={() => setMarkingSlot(l.id)}>
                      Take attendance
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        )}
        <Card title="My classes" padded={false} className="lg:col-span-2">
          {d.classTeacherOf.length || d.teaching.length ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Class</th>
                  <th>Role</th>
                  <th>Attendance today</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {d.classTeacherOf.map((c: any) => (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/school/classes/${c.id}`} className="font-medium text-brand hover:underline">
                        {c.name}
                      </Link>{' '}
                      <span className="text-xs text-slate-500">({c.students} students)</span>
                    </td>
                    <td>
                      <Badge tone="brand">Class teacher</Badge>
                    </td>
                    <td>
                      {c.attendanceMarkedToday ? (
                        <span className="flex items-center gap-1 text-emerald-700">
                          <CheckCircle2 size={14} /> Marked
                        </span>
                      ) : (
                        <Link href={`/school/attendance?classId=${c.id}`} className="text-amber-700 hover:underline">
                          Not marked
                        </Link>
                      )}
                    </td>
                    <td className="text-right text-xs">
                      <Link href={`/school/results/sheets?classId=${c.id}`} className="text-brand hover:underline">
                        Results
                      </Link>
                    </td>
                  </tr>
                ))}
                {d.teaching.map((t: any) => (
                  <tr key={t.classId + t.subjectId}>
                    <td>
                      <Link href={`/school/classes/${t.classId}`} className="text-brand hover:underline">
                        {t.className}
                      </Link>
                    </td>
                    <td>{t.subjectName}</td>
                    <td>
                      {t.attendanceMarkedToday ? (
                        <span className="text-emerald-700">Marked</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="text-right text-xs">
                      <Link href={`/school/results?classId=${t.classId}`} className="text-brand hover:underline">
                        Marks
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState
              title="No classes assigned yet"
              description="Ask the administrator to assign you as a class or subject teacher."
            />
          )}
        </Card>
        <Card
          title="Today's timetable"
          padded={false}
          actions={
            <Link href="/school/timetable" className="text-xs text-brand hover:underline">
              Full week
            </Link>
          }
        >
          {d.today.length ? (
            <ul className="divide-y divide-slate-100 text-sm">
              {d.today.map((s: any, i: number) => (
                <li key={i} className="flex items-center gap-3 px-4 py-2">
                  <span className="w-24 shrink-0 text-xs text-slate-500">{s.time}</span>
                  <div>
                    <p className="font-medium">{s.subject}</p>
                    <p className="text-xs text-slate-500">
                      {s.class}
                      {s.room ? ` · ${s.room}` : ''} · {s.period}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No lessons today" />
          )}
        </Card>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <Card
          title="Homework due soon"
          padded={false}
          actions={
            has('ASSIGNMENTS') && (
              <Link href="/school/assignments" className="text-xs text-brand hover:underline">
                All
              </Link>
            )
          }
        >
          {d.assignmentsDue?.length ? (
            <ul className="divide-y divide-slate-100 text-sm">
              {d.assignmentsDue.map((a: any) => (
                <li key={a.id} className="px-4 py-2">
                  <div className="flex items-center justify-between">
                    <Link href={`/school/assignments/${a.id}`} className="font-medium text-brand hover:underline">
                      {a.title}
                    </Link>
                    {a.toGrade > 0 && <Badge tone="amber">{`${a.toGrade} to grade`}</Badge>}
                  </div>
                  <p className="text-xs text-slate-500">
                    {a.subject} · {a.className} · due {fmtDateTime(a.dueAt)}
                  </p>
                  <div className="mt-1">
                    <ProgressBar value={a.total ? Math.round((a.submitted / a.total) * 100) : 0} tone="emerald" />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="No homework due"
              action={
                has('ASSIGNMENTS') && (
                  <Link href="/school/assignments" className="btn-secondary">
                    Create assignment
                  </Link>
                )
              }
            />
          )}
        </Card>
        <Card
          title="Assessments this term"
          padded={false}
          actions={
            <Link href="/school/results" className="text-xs text-brand hover:underline">
              Manage
            </Link>
          }
        >
          {d.assessments.length ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Assessment</th>
                  <th className="text-right">Marks</th>
                </tr>
              </thead>
              <tbody>
                {d.assessments.slice(0, 8).map((a: any) => (
                  <tr key={a.id}>
                    <td>
                      <Link href={`/school/results/assessments/${a.id}`} className="text-brand hover:underline">
                        {a.name}
                      </Link>
                      <p className="text-xs text-slate-500">
                        {a.subject} · <Badge tone="slate">{a.type}</Badge>
                      </p>
                    </td>
                    <td className="text-right">{a.marksEntered}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState
              title="No assessments yet"
              action={
                <Link href="/school/results" className="btn-secondary">
                  Create one
                </Link>
              }
            />
          )}
        </Card>
        <Card title="Upcoming events">
          <Timeline
            items={(d.upcomingEvents ?? []).map((e: any) => ({
              id: e.id,
              title: e.title,
              meta: e.allDay ? fmtDate(e.startAt) : fmtDateTime(e.startAt),
              tone:
                { HOLIDAY: 'emerald', EXAM: 'red', MEETING: 'sky', SPORTS: 'amber', TRIP: 'violet' }[
                  e.type as string
                ] ?? 'brand',
            }))}
          />
        </Card>
      </div>

      {d.resultsByClass.length > 0 && (
        <>
          <SectionTitle>Results workflow (my classes)</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {d.resultsByClass.map((c: any) => (
              <Link
                key={c.classId}
                href={`/school/results/sheets?classId=${c.classId}`}
                className="card p-4 hover:border-brand"
              >
                <p className="font-medium">{c.name}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {Object.keys(c.byStatus).length ? (
                    Object.entries(c.byStatus).map(([k, v]) => <Badge key={k}>{`${title(k)} ${v}`}</Badge>)
                  ) : (
                    <span className="text-xs text-slate-400">Not computed</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      <SectionTitle>Quick actions</SectionTitle>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {[
          { href: '/school/attendance', label: 'Mark attendance', icon: ClipboardCheck },
          ...(has('ASSIGNMENTS') ? [{ href: '/school/assignments', label: 'New homework', icon: ClipboardList }] : []),
          ...(has('DISCIPLINE') && can('DISCIPLINE_MANAGE')
            ? [{ href: '/school/discipline', label: 'Log incident', icon: Scale }]
            : []),
          ...(has('MESSAGING') ? [{ href: '/school/messages', label: 'Message parents', icon: MessageSquare }] : []),
          { href: '/school/results', label: 'Enter marks', icon: FileBarChart },
          ...(has('HR') ? [{ href: '/school/hr', label: 'Request leave', icon: Clock }] : []),
        ].map((q) => (
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
      {markingSlot && (
        <LessonAttendanceModal
          slotId={markingSlot}
          onClose={() => setMarkingSlot(null)}
          onDone={reloadLessons}
        />
      )}
    </div>
  );
}
