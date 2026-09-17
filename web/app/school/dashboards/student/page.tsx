'use client';
import Link from 'next/link';
import { BookMarked, CalendarDays, ClipboardList, FileBarChart, MessageSquare } from 'lucide-react';
import { useApi } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { DAYS, fmtDate, fmtDateTime, money } from '@/lib/format';
import { Badge, Card, EmptyState, PageHeader, SectionTitle, Spinner, StatCard, Timeline } from '@/components/ui';

/** Student portal home: today's lessons, homework, results, events and announcements. */
export default function StudentDashboard() {
  const { me, has } = useAuth();
  const { data: d, loading } = useApi('/portal/overview');
  const c = d?.children?.[0];
  const { data: timetable } = useApi(c && has('TIMETABLE') ? `/portal/children/${c.id}/timetable` : null, [c?.id]);
  if (loading || !d) return <Spinner />;
  if (!c)
    return (
      <EmptyState title="Your student record is not linked" description="Ask the school office to link your login." />
    );
  const dow = new Date().getDay() || 7;
  const today = (timetable ?? [])
    .filter((s: any) => s.dayOfWeek === dow)
    .sort((a: any, b: any) => a.period.sequence - b.period.sequence);
  const homework = (d.assignmentsDue ?? []).filter((a: any) => a.student.id === c.id);
  return (
    <div>
      <PageHeader
        title={`Hi, ${me?.user.firstName}`}
        subtitle={`${c.class?.name ?? ''} · ${c.studentId} · ${DAYS[dow]}`}
        actions={
          d.unreadMessages > 0 &&
          has('MESSAGING') && (
            <Link href="/school/messages" className="btn-secondary">
              <MessageSquare size={16} /> {d.unreadMessages} new
            </Link>
          )
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Attendance (30 days)"
          value={c.attendance30d.rate === null ? '—' : `${c.attendance30d.rate}%`}
          hint={`${c.attendance30d.present} of ${c.attendance30d.total} days`}
          tone="emerald"
          icon={<CalendarDays size={20} />}
        />
        <StatCard
          label="Latest average"
          value={c.latestResult ? `${Number(c.latestResult.average).toFixed(1)}%` : '—'}
          hint={
            c.latestResult
              ? `${c.latestResult.term} · grade ${c.latestResult.overallGrade ?? '—'} · position ${c.latestResult.position ?? '—'}/${c.latestResult.classSize}`
              : 'No published results'
          }
          icon={<FileBarChart size={20} />}
        />
        <StatCard
          label="Homework pending"
          value={homework.length}
          hint={
            homework.filter((a: any) => a.overdue).length
              ? `${homework.filter((a: any) => a.overdue).length} overdue`
              : 'all on time'
          }
          icon={<ClipboardList size={20} />}
          tone={homework.some((a: any) => a.overdue) ? 'red' : 'amber'}
        />
        <StatCard
          label="Canteen wallet"
          value={money(c.walletBalance, d.school.currency)}
          icon={<BookMarked size={20} />}
          tone="sky"
        />
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <Card
          title="Today's lessons"
          padded={false}
          actions={
            has('TIMETABLE') && (
              <Link
                href={`/school/portal/children/${c.id}?tab=timetable`}
                className="text-xs text-brand hover:underline"
              >
                Full week
              </Link>
            )
          }
        >
          {today.length ? (
            <ul className="divide-y divide-slate-100 text-sm">
              {today.map((s: any) => (
                <li key={s.id} className="flex items-center gap-3 px-4 py-2">
                  <span className="w-24 shrink-0 text-xs text-slate-500">
                    {s.period.startTime}–{s.period.endTime}
                  </span>
                  <div>
                    <p className="font-medium">{s.subject.name}</p>
                    <p className="text-xs text-slate-500">
                      {s.teacher ? `${s.teacher.firstName} ${s.teacher.lastName}` : ''}
                      {s.room ? ` · ${s.room.name}` : ''}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title={has('TIMETABLE') ? 'No lessons today' : 'Timetable not enabled'} />
          )}
        </Card>
        <Card
          title="Homework"
          padded={false}
          actions={
            has('ASSIGNMENTS') && (
              <Link
                href={`/school/portal/children/${c.id}?tab=assignments`}
                className="text-xs text-brand hover:underline"
              >
                All
              </Link>
            )
          }
        >
          {homework.length ? (
            <ul className="divide-y divide-slate-100 text-sm">
              {homework.map((a: any) => (
                <li key={a.id} className="px-4 py-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{a.title}</span>
                    {a.overdue && <Badge tone="red">Overdue</Badge>}
                  </div>
                  <p className="text-xs text-slate-500">
                    {a.subject} · due {fmtDateTime(a.dueAt)}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No homework pending 🎉" />
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
      <SectionTitle>Quick links</SectionTitle>
      <div className="flex flex-wrap gap-2">
        <Link href={`/school/portal/children/${c.id}?tab=results`} className="btn-primary">
          My results
        </Link>
        <Link href={`/school/portal/children/${c.id}?tab=attendance`} className="btn-secondary">
          My attendance
        </Link>
        {has('LIBRARY') && (
          <Link href={`/school/portal/children/${c.id}?tab=library`} className="btn-secondary">
            Library books
          </Link>
        )}
        {has('DISCIPLINE') && (
          <Link href={`/school/portal/children/${c.id}?tab=discipline`} className="btn-secondary">
            Behaviour
          </Link>
        )}
        {has('MESSAGING') && (
          <Link href="/school/messages" className="btn-secondary">
            Message a teacher
          </Link>
        )}
      </div>
      <Card title="Announcements" className="mt-5" padded={false}>
        {d.announcements.length ? (
          <ul className="divide-y divide-slate-100">
            {d.announcements.map((a: any) => (
              <li key={a.id} className="p-4">
                <p className="font-medium">
                  {a.title} <Badge tone="slate">{fmtDate(a.publishedAt)}</Badge>
                </p>
                <p className="mt-0.5 text-sm text-slate-600">{a.body}</p>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No announcements" />
        )}
      </Card>
    </div>
  );
}
