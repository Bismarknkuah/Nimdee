'use client';
import clsx from 'clsx';
import {
  Bell,
  BookMarked,
  BookOpen,
  Briefcase,
  Building2,
  Bus,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  FileBarChart,
  Globe,
  GraduationCap,
  HeartPulse,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  MessageSquare,
  Package,
  PieChart,
  RefreshCw,
  Scale,
  Settings,
  ShieldCheck,
  ShoppingBasket,
  UserPlus,
  Users,
  UsersRound,
  Wallet,
  WifiOff,
  X,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { dashboardFor, useAuth } from '@/lib/auth';
import { useOffline } from '@/lib/offline';
import { ago } from '@/lib/format';
import { Badge, Spinner } from '@/components/ui';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  perms?: string[];
  feature?: string;
  roles?: string[];
}
interface NavGroup {
  title?: string;
  items: NavItem[];
}

const SCHOOL_NAV: NavGroup[] = [
  { items: [{ href: '/school', label: 'Dashboard', icon: LayoutDashboard }] },
  {
    title: 'People',
    items: [
      { href: '/school/students', label: 'Students', icon: GraduationCap, perms: ['STUDENT_VIEW'] },
      { href: '/school/guardians', label: 'Parents & guardians', icon: UsersRound, perms: ['STUDENT_VIEW'] },
      { href: '/school/staff', label: 'Staff', icon: Users, perms: ['STAFF_VIEW'] },
      { href: '/school/admissions', label: 'Admissions', icon: UserPlus, perms: ['ADMISSIONS_MANAGE'] },
      { href: '/school/id-cards', label: 'ID cards', icon: ShieldCheck, perms: ['STUDENT_VIEW'] },
    ],
  },
  {
    title: 'Academics',
    items: [
      {
        href: '/school/academics',
        label: 'Classes & subjects',
        icon: BookOpen,
        perms: ['ACADEMIC_MANAGE', 'STUDENT_VIEW'],
      },
      {
        href: '/school/attendance',
        label: 'Attendance',
        icon: ClipboardCheck,
        perms: ['ATTENDANCE_MARK', 'ATTENDANCE_VIEW'],
        feature: 'ATTENDANCE',
      },
      {
        href: '/school/results',
        label: 'Results & exams',
        icon: FileBarChart,
        perms: ['RESULT_ENTER', 'RESULT_VIEW'],
        feature: 'RESULTS',
      },
      {
        href: '/school/timetable',
        label: 'Timetable',
        icon: CalendarDays,
        perms: ['TIMETABLE_VIEW'],
        feature: 'TIMETABLE',
      },
      {
        href: '/school/assignments',
        label: 'Assignments',
        icon: ClipboardList,
        perms: ['ASSIGNMENTS_VIEW'],
        feature: 'ASSIGNMENTS',
      },
      {
        href: '/school/discipline',
        label: 'Discipline',
        icon: Scale,
        perms: ['DISCIPLINE_VIEW'],
        feature: 'DISCIPLINE',
      },
      { href: '/school/library', label: 'Library', icon: BookMarked, perms: ['LIBRARY_VIEW'], feature: 'LIBRARY' },
    ],
  },
  {
    title: 'Welfare & operations',
    items: [
      { href: '/school/events', label: 'Calendar & events', icon: CalendarDays, feature: 'EVENTS' },
      {
        href: '/school/messages',
        label: 'Messages',
        icon: MessageSquare,
        perms: ['MESSAGES_SEND'],
        feature: 'MESSAGING',
      },
      { href: '/school/health', label: 'Clinic', icon: HeartPulse, perms: ['HEALTH_VIEW'], feature: 'HEALTH' },
      { href: '/school/transport', label: 'Transport', icon: Bus, perms: ['TRANSPORT_VIEW'], feature: 'TRANSPORT' },
      {
        href: '/school/hr',
        label: 'HR & payroll',
        icon: Briefcase,
        perms: ['LEAVE_REQUEST', 'HR_MANAGE', 'PAYROLL_MANAGE'],
        feature: 'HR',
      },
    ],
  },
  {
    title: 'Finance',
    items: [
      { href: '/school/fees', label: 'Fees & invoices', icon: CreditCard, perms: ['FEES_VIEW'], feature: 'FEES' },
      {
        href: '/school/fees/payments',
        label: 'Payments',
        icon: Wallet,
        perms: ['FEES_VIEW', 'PAYMENT_RECORD'],
        feature: 'FEES',
      },
      {
        href: '/school/canteen',
        label: 'Canteen',
        icon: ShoppingBasket,
        perms: ['CANTEEN_VIEW', 'CANTEEN_SELL'],
        feature: 'CANTEEN',
      },
      { href: '/school/inventory', label: 'Inventory', icon: Package, perms: ['INVENTORY_VIEW'], feature: 'INVENTORY' },
    ],
  },
  {
    title: 'School',
    items: [
      {
        href: '/school/announcements',
        label: 'Announcements',
        icon: Megaphone,
        perms: ['ANNOUNCEMENT_MANAGE'],
        feature: 'COMMUNICATIONS',
      },
      { href: '/school/reports', label: 'Reports & analytics', icon: PieChart, perms: ['REPORTS_VIEW'] },
      {
        href: '/school/sync',
        label: 'Offline devices',
        icon: RefreshCw,
        perms: ['SYNC_MANAGE'],
        feature: 'OFFLINE_SYNC',
      },
      { href: '/school/website', label: 'Website', icon: Globe, perms: ['WEBSITE_MANAGE'], feature: 'WEBSITE' },
      { href: '/school/users', label: 'Users & roles', icon: ShieldCheck, perms: ['USERS_MANAGE'] },
      { href: '/school/audit', label: 'Audit log', icon: FileBarChart, perms: ['AUDIT_VIEW'] },
      {
        href: '/school/settings',
        label: 'Settings',
        icon: Settings,
        perms: ['SCHOOL_MANAGE', 'SETTINGS_MANAGE', 'SUBSCRIPTION_MANAGE'],
      },
    ],
  },
];
const PORTAL_NAV: NavGroup[] = [
  {
    items: [
      { href: '/school', label: 'Home', icon: LayoutDashboard },
      {
        href: '/school/messages',
        label: 'Messages',
        icon: MessageSquare,
        perms: ['MESSAGES_SEND'],
        feature: 'MESSAGING',
      },
      { href: '/school/events', label: 'Calendar', icon: CalendarDays, feature: 'EVENTS' },
      { href: '/school/portal/notifications', label: 'Notifications', icon: Bell },
    ],
  },
];
const PLATFORM_NAV: NavGroup[] = [
  {
    items: [
      { href: '/platform', label: 'Overview', icon: LayoutDashboard },
      { href: '/platform/schools', label: 'Schools', icon: Building2 },
      { href: '/platform/plans', label: 'Plans', icon: CreditCard },
      { href: '/platform/invoices', label: 'Subscription invoices', icon: Wallet },
      { href: '/platform/sync', label: 'Sync health', icon: RefreshCw },
      { href: '/platform/users', label: 'Platform users', icon: ShieldCheck },
      { href: '/platform/audit', label: 'Audit log', icon: FileBarChart },
    ],
  },
];

export function AppShell({ children, mode }: { children: React.ReactNode; mode: 'school' | 'platform' }) {
  const { me, loading, logout, can, has, role } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const offline = useOffline();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (loading) return;
    if (!me) {
      router.replace(mode === 'platform' ? '/platform/login' : `/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    if (mode === 'platform' && me.type !== 'PLATFORM') router.replace(dashboardFor(role));
    if (mode === 'school' && me.type !== 'TENANT') router.replace('/platform');
  }, [me, loading, mode, router, pathname, role]);

  useEffect(() => {
    if (!me || me.type !== 'TENANT') return;
    const load = () =>
      api
        .get('/notifications/me')
        .then((d) => setUnread(d.unread))
        .catch(() => undefined);
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [me]);

  const groups = useMemo(() => {
    if (mode === 'platform') return PLATFORM_NAV;
    if (role === 'parent' || role === 'student')
      return PORTAL_NAV.map((g) => ({
        ...g,
        items: g.items.filter((i) => (!i.perms || can(...i.perms)) && (!i.feature || has(i.feature))),
      }));
    return SCHOOL_NAV.map((g) => ({
      ...g,
      items: g.items.filter((i) => (!i.perms || can(...i.perms)) && (!i.feature || has(i.feature))),
    })).filter((g) => g.items.length);
  }, [mode, role, can, has]);

  if (loading || !me) return <Spinner className="h-screen" />;
  const tenant = me.tenant;
  const sub = me.subscription;
  const subWarning = sub && ['TRIAL', 'GRACE', 'PAST_DUE'].includes(sub.status) ? sub : null;
  const isActive = (href: string) =>
    href === '/school' || href === '/platform'
      ? pathname === href || pathname.startsWith(href + '/dashboards')
      : pathname === href || pathname.startsWith(href + '/');

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-4 py-4">
        {tenant?.logoUrl ? (
          <img src={tenant.logoUrl} alt="" className="h-9 w-9 rounded-lg object-cover" />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-sm font-bold text-white">
            {mode === 'platform' ? 'N' : (tenant?.name ?? 'S').slice(0, 1)}
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">
            {mode === 'platform' ? 'Nimdee' : tenant?.name}
          </p>
          <p className="truncate text-xs text-slate-500">{mode === 'platform' ? 'Platform console' : tenant?.code}</p>
        </div>
      </div>
      <nav className="flex-1 space-y-4 overflow-y-auto px-2 pb-4">
        {groups.map((g, gi) => (
          <div key={gi}>
            {g.title && (
              <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{g.title}</p>
            )}
            {g.items.map((i) => (
              <Link
                key={i.href}
                href={i.href}
                onClick={() => setOpen(false)}
                className={clsx(
                  'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm',
                  isActive(i.href) ? 'bg-brand-soft font-medium text-brand-dark' : 'text-slate-600 hover:bg-slate-100',
                )}
              >
                <i.icon size={17} />
                {i.label}
              </Link>
            ))}
          </div>
        ))}
      </nav>
      <div className="border-t border-slate-100 p-3">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-800">
              {me.user.name ?? `${me.user.firstName} ${me.user.lastName}`}
            </p>
            <p className="truncate text-xs text-slate-500">{me.roles?.join(', ') ?? me.user.role}</p>
          </div>
          <button onClick={logout} title="Sign out" className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100">
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="no-print hidden w-64 shrink-0 border-r border-slate-200 bg-white lg:block">
        <div className="sticky top-0 h-screen">{sidebar}</div>
      </aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-white shadow-xl">
            {sidebar}
            <button onClick={() => setOpen(false)} className="absolute right-2 top-3 rounded-md p-1 text-slate-500">
              <X size={18} />
            </button>
          </aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur">
          <button
            className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden"
            onClick={() => setOpen(true)}
          >
            <Menu size={20} />
          </button>
          <div className="flex-1" />
          {mode === 'school' && has('OFFLINE_SYNC') && (
            <button
              onClick={() => offline.sync()}
              title={offline.lastSync ? `Last sync ${ago(offline.lastSync)}` : 'Not synced yet'}
              className={clsx(
                'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
                !offline.online
                  ? 'bg-amber-50 text-amber-700'
                  : offline.pending
                    ? 'bg-sky-50 text-sky-700'
                    : 'bg-emerald-50 text-emerald-700',
              )}
            >
              {!offline.online ? (
                <WifiOff size={13} />
              ) : (
                <RefreshCw size={13} className={offline.syncing ? 'animate-spin' : ''} />
              )}
              {!offline.online ? 'Offline' : offline.pending ? `${offline.pending} to sync` : 'Synced'}
            </button>
          )}
          {mode === 'school' && (
            <Link
              href="/school/portal/notifications"
              className="relative rounded-md p-1.5 text-slate-600 hover:bg-slate-100"
            >
              <Bell size={19} />
              {unread > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {unread}
                </span>
              )}
            </Link>
          )}
        </header>
        {me.isSupportSession && (
          <div className="bg-amber-500 px-4 py-1.5 text-center text-xs font-medium text-white">
            Platform support session. Every action is audited under your platform account.
          </div>
        )}
        {subWarning && mode === 'school' && (
          <div className="bg-amber-50 px-4 py-1.5 text-center text-xs text-amber-800">
            {sub.status === 'TRIAL'
              ? `Free trial ends ${ago(sub.trialEndsAt)}.`
              : sub.status === 'GRACE'
                ? 'Your trial has ended. Subscribe to keep access.'
                : 'Your subscription payment is overdue.'}{' '}
            {can('SUBSCRIPTION_MANAGE') && (
              <Link href="/school/settings?tab=subscription" className="font-semibold underline">
                Manage subscription
              </Link>
            )}
          </div>
        )}
        {tenant?.status === 'PENDING' && (
          <div className="bg-sky-50 px-4 py-1.5 text-center text-xs text-sky-800">
            Your school is awaiting approval by the platform team. You can update your profile meanwhile.
          </div>
        )}
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  return <Badge>{status}</Badge>;
}
