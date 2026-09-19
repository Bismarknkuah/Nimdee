'use client';
import Link from 'next/link';
import { Bell, CalendarDays, ClipboardList, CreditCard, MessageSquare, Wallet } from 'lucide-react';
import { useApi } from '@/lib/hooks';
import { useAuth } from '@/lib/auth';
import { fmtDate, fmtDateTime, money } from '@/lib/format';
import {
  Avatar,
  Badge,
  Card,
  EmptyState,
  PageHeader,
  ProgressBar,
  SectionTitle,
  Spinner,
  StatCard,
  Timeline,
} from '@/components/ui';

/** Parent portal home: every child at a glance, homework due, events, messages and announcements. */
export default function ParentDashboard() {
  const { me, has } = useAuth();
  const { data: d, loading } = useApi('/portal/overview');
  const { data: menuData } = useApi<any>(has('CANTEEN') ? '/portal/canteen-menu' : null);
  if (loading || !d) return <Spinner />;
  const cur = d.school.currency;
  const totalBalance = d.children.reduce((a: number, c: any) => a + Number(c.balance), 0);
  const overdueHomework = (d.assignmentsDue ?? []).filter((a: any) => a.overdue).length;
  const todayKey = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'][new Date().getDay()];
  const todaysMeal = menuData?.weeklyMenu?.[todayKey];
  return (
    <div>
      <PageHeader
        title={`Welcome, ${me?.user.firstName}`}
        subtitle={d.school.name}
        actions={
          <>
            {d.unreadMessages > 0 && has('MESSAGING') && (
              <Link href="/school/messages" className="btn-secondary">
                <MessageSquare size={16} /> {d.unreadMessages} new message(s)
              </Link>
            )}
            {d.unreadNotifications > 0 && (
              <Link href="/school/portal/notifications" className="btn-secondary">
                <Bell size={16} /> {d.unreadNotifications} new
              </Link>
            )}
          </>
        }
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Children"
          value={d.children.length}
          hint={d.children.map((c: any) => c.firstName).join(', ')}
          icon={<Avatar name={d.children[0]?.firstName ?? 'S'} size="sm" />}
        />
        <StatCard
          label="Fees balance"
          value={money(totalBalance, cur)}
          hint={totalBalance > 0 ? 'Tap a child to pay online' : 'All settled, thank you'}
          icon={<CreditCard size={20} />}
          tone={totalBalance > 0 ? 'red' : 'emerald'}
        />
        <StatCard
          label="Homework due"
          value={(d.assignmentsDue ?? []).length}
          hint={overdueHomework ? `${overdueHomework} overdue` : 'nothing overdue'}
          icon={<ClipboardList size={20} />}
          tone={overdueHomework ? 'amber' : 'brand'}
        />
        <StatCard
          label="Upcoming events"
          value={(d.upcomingEvents ?? []).length}
          hint={d.upcomingEvents?.[0] ? `Next: ${d.upcomingEvents[0].title}` : ''}
          icon={<CalendarDays size={20} />}
          tone="violet"
        />
      </div>
      {d.children.length === 0 && (
        <div className="mt-5">
          <EmptyState
            title="No children linked to your account"
            description="Ask the school office to link your child to this login."
          />
        </div>
      )}
      <SectionTitle>My children</SectionTitle>
      <div className="grid gap-4 lg:grid-cols-2">
        {d.children.map((c: any) => (
          <Card key={c.id} className="overflow-hidden" padded={false}>
            <div className="flex items-center gap-3 border-b border-slate-100 p-4">
              <Avatar name={`${c.firstName} ${c.lastName}`} src={c.photoUrl} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-semibold text-slate-900">
                  {c.firstName} {c.lastName}
                </p>
                <p className="text-sm text-slate-500">
                  {c.class?.name ?? 'No class'} · {c.studentId}
                </p>
                {c.class?.classTeacher && (
                  <p className="text-xs text-slate-500">
                    Class teacher: {c.class.classTeacher.firstName} {c.class.classTeacher.lastName}
                    {c.class.classTeacher.phone ? ` · ${c.class.classTeacher.phone}` : ''}
                  </p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-3 divide-x divide-slate-100 text-center text-sm">
              <div className="p-3">
                <p className="text-xs text-slate-500">Attendance (30d)</p>
                <p className="font-semibold">{c.attendance30d.rate === null ? '—' : `${c.attendance30d.rate}%`}</p>
                {c.attendance30d.rate !== null && (
                  <div className="mt-1">
                    <ProgressBar value={c.attendance30d.rate} tone={c.attendance30d.rate >= 90 ? 'emerald' : 'amber'} />
                  </div>
                )}
              </div>
              <div className="p-3">
                <p className="text-xs text-slate-500">Fees balance</p>
                <p className={`font-semibold ${Number(c.balance) > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                  {money(c.balance, cur)}
                </p>
              </div>
              <div className="p-3">
                <p className="text-xs text-slate-500">Canteen wallet</p>
                <p className="font-semibold">{money(c.walletBalance, cur)}</p>
              </div>
            </div>
            {c.latestResult ? (
              <div className="border-t border-slate-100 px-4 py-2 text-sm">
                Latest result: <b>{c.latestResult.term}</b>, average {Number(c.latestResult.average).toFixed(1)}%{' '}
                <Badge tone="brand">{c.latestResult.overallGrade ?? '—'}</Badge>
                {c.latestResult.position && (
                  <span className="text-slate-500">
                    {' '}
                    · position {c.latestResult.position}/{c.latestResult.classSize}
                  </span>
                )}
              </div>
            ) : (
              <div className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">No published results yet</div>
            )}
            <div className="flex flex-wrap gap-2 border-t border-slate-100 p-3">
              <Link href={`/school/portal/children/${c.id}`} className="btn-primary">
                View details
              </Link>
              <Link href={`/school/portal/children/${c.id}?tab=fees`} className="btn-secondary">
                <CreditCard size={15} /> Fees
              </Link>
              {has('ASSIGNMENTS') && (
                <Link href={`/school/portal/children/${c.id}?tab=assignments`} className="btn-secondary">
                  <ClipboardList size={15} /> Homework
                </Link>
              )}
              {has('CANTEEN') && (
                <Link href={`/school/portal/children/${c.id}?tab=wallet`} className="btn-secondary">
                  <Wallet size={15} /> Wallet
                </Link>
              )}
            </div>
          </Card>
        ))}
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        {has('ASSIGNMENTS') && (
          <Card title="Homework due" padded={false}>
            {d.assignmentsDue?.length ? (
              <ul className="divide-y divide-slate-100 text-sm">
                {d.assignmentsDue.map((a: any) => (
                  <li key={a.id + a.student.id} className="px-4 py-2">
                    <div className="flex items-center justify-between">
                      <Link
                        href={`/school/portal/children/${a.student.id}?tab=assignments`}
                        className="font-medium hover:underline"
                      >
                        {a.title}
                      </Link>
                      {a.overdue && <Badge tone="red">Overdue</Badge>}
                    </div>
                    <p className="text-xs text-slate-500">
                      {a.student.firstName} · {a.subject} · due {fmtDateTime(a.dueAt)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No homework pending" />
            )}
          </Card>
        )}
        {has('EVENTS') && (
          <Card
            title="Upcoming events"
            actions={
              <Link href="/school/events" className="text-xs text-brand hover:underline">
                Calendar
              </Link>
            }
          >
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
          </Card>
        )}
        {has('CANTEEN') && todaysMeal && (
          <Card
            title="Today's meal"
            actions={
              <Link href="/school/canteen/menu" className="text-xs text-brand hover:underline">
                Full week
              </Link>
            }
          >
            <p className="text-sm text-slate-700">{todaysMeal}</p>
          </Card>
        )}
        <Card title="School announcements" padded={false}>
          {d.announcements.length ? (
            <ul className="divide-y divide-slate-100">
              {d.announcements.map((a: any) => (
                <li key={a.id} className="p-4">
                  <p className="font-medium text-slate-900">{a.title}</p>
                  <p className="mt-0.5 line-clamp-3 text-sm text-slate-600">{a.body}</p>
                  <p className="mt-1 text-xs text-slate-400">{fmtDate(a.publishedAt)}</p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No announcements yet" />
          )}
        </Card>
      </div>
    </div>
  );
}
