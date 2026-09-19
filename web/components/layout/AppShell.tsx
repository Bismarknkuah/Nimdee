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
  ChevronDown,
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
  UserPlus,
  Users,
  UserCircle,
  UsersRound,
  Utensils,
  Wallet,
  Receipt,
  WifiOff,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { dashboardFor, useAuth } from '@/lib/auth';
import { useOffline } from '@/lib/offline';
import { ago } from '@/lib/format';
import { Badge, Button, Field, ImageUpload, Input, Modal, Spinner, Textarea, useToast } from '@/components/ui';

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
      {
        href: '/school/admissions',
        label: 'Admissions',
        icon: UserPlus,
        perms: ['ADMISSIONS_VIEW', 'ADMISSIONS_MANAGE'],
      },
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
        href: '/school/attendance/lessons',
        label: 'My lessons today',
        icon: ClipboardCheck,
        perms: ['ATTENDANCE_MARK'],
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
        href: '/school/expenses',
        label: 'Expenses',
        icon: Receipt,
        perms: ['EXPENSE_VIEW'],
        feature: 'FEES',
      },
      {
        href: '/school/canteen/checkin',
        label: 'Meal check-in',
        icon: Utensils,
        perms: ['CANTEEN_VIEW', 'CANTEEN_SELL'],
        feature: 'CANTEEN',
      },
      {
        href: '/school/canteen/plans',
        label: 'Meal plans',
        icon: ClipboardList,
        perms: ['CANTEEN_MANAGE'],
        feature: 'CANTEEN',
      },
      {
        href: '/school/canteen/pay',
        label: 'Record feeding payment',
        icon: Wallet,
        perms: ['CANTEEN_MANAGE'],
        feature: 'CANTEEN',
      },
      {
        href: '/school/canteen/menu',
        label: 'Food timetable',
        icon: CalendarDays,
        perms: ['CANTEEN_VIEW', 'CANTEEN_MANAGE'],
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
/**
 * One flat, permission- and feature-aware list of shortcuts for every staff role, shown from the
 * header quick-actions menu on every page (not just the dashboard). Parents and students get their
 * own separate list below, since their access model is entirely different from staff RBAC.
 */
const QUICK_LINKS: NavItem[] = [
  { href: '/school/students/new', label: 'Enrol student', icon: UserPlus, perms: ['STUDENT_CREATE'] },
  {
    href: '/school/attendance',
    label: 'Mark attendance',
    icon: ClipboardCheck,
    perms: ['ATTENDANCE_MARK'],
    feature: 'ATTENDANCE',
  },
  {
    href: '/school/fees/payments/new',
    label: 'Record payment',
    icon: Wallet,
    perms: ['PAYMENT_RECORD'],
    feature: 'FEES',
  },
  { href: '/school/results', label: 'Enter marks', icon: FileBarChart, perms: ['RESULT_ENTER'], feature: 'RESULTS' },
  {
    href: '/school/assignments',
    label: 'New homework',
    icon: ClipboardList,
    perms: ['ASSIGNMENTS_MANAGE'],
    feature: 'ASSIGNMENTS',
  },
  {
    href: '/school/announcements',
    label: 'Announce',
    icon: Megaphone,
    perms: ['MESSAGES_SEND'],
    feature: 'COMMUNICATIONS',
  },
  {
    href: '/school/discipline',
    label: 'Log incident',
    icon: Scale,
    perms: ['DISCIPLINE_MANAGE'],
    feature: 'DISCIPLINE',
  },
  { href: '/school/messages', label: 'Messages', icon: MessageSquare, feature: 'MESSAGING' },
  { href: '/school/events', label: 'Calendar', icon: CalendarDays, feature: 'EVENTS' },
  { href: '/school/hr', label: 'Leave & payroll', icon: Briefcase, perms: ['HR_MANAGE', 'LEAVE_REQUEST'], feature: 'HR' },
  {
    href: '/school/canteen/checkin',
    label: 'Meal check-in',
    icon: Utensils,
    perms: ['CANTEEN_SELL'],
    feature: 'CANTEEN',
  },
  {
    href: '/school/canteen/plans',
    label: 'Meal plans',
    icon: ClipboardList,
    perms: ['CANTEEN_MANAGE'],
    feature: 'CANTEEN',
  },
  {
    href: '/school/canteen/pay',
    label: 'Feeding payment',
    icon: Wallet,
    perms: ['CANTEEN_MANAGE'],
    feature: 'CANTEEN',
  },
  { href: '/school/canteen/wallets', label: 'Wallet top-up', icon: Wallet, perms: ['WALLET_TOPUP'] },
  { href: '/school/library', label: 'Library', icon: BookMarked, perms: ['LIBRARY_VIEW'], feature: 'LIBRARY' },
  { href: '/school/health', label: 'Clinic', icon: HeartPulse, perms: ['HEALTH_VIEW'], feature: 'HEALTH' },
  { href: '/school/staff', label: 'Staff', icon: Users, perms: ['STAFF_VIEW'] },
  { href: '/school/expenses', label: 'Record expense', icon: Receipt, perms: ['EXPENSE_CREATE'], feature: 'FEES' },
  { href: '/school/expenses', label: 'Approve expenses', icon: ClipboardCheck, perms: ['EXPENSE_APPROVE'], feature: 'FEES' },
  {
    href: '/school/academics?tab=responsibilities',
    label: 'Assign form/house master',
    icon: Users,
    perms: ['ACADEMIC_MANAGE'],
  },
  { href: '/school/users', label: 'Roles & features', icon: ShieldCheck, perms: ['ROLES_MANAGE', 'SCHOOL_MANAGE'] },
  { href: '/school/website', label: 'Website builder', icon: LayoutDashboard, perms: ['SCHOOL_MANAGE'] },
  { href: '/school/reports', label: 'Reports', icon: FileBarChart, perms: ['REPORTS_VIEW'] },
  { href: '/school/audit', label: 'Audit log', icon: ShieldCheck, perms: ['AUDIT_VIEW'] },
  {
    href: '/school/settings?tab=subscription',
    label: 'Subscription',
    icon: CreditCard,
    perms: ['SUBSCRIPTION_MANAGE'],
  },
  { href: '/school/settings?tab=data', label: 'Backup data', icon: RefreshCw, perms: ['SCHOOL_MANAGE'] },
];
/** Parents and students hold no staff RBAC permissions at all, so they need their own short, always-
 *  relevant list rather than being filtered out of the staff one down to almost nothing. */
const PORTAL_QUICK_LINKS: NavItem[] = [
  { href: '/school/portal/notifications', label: 'Notifications', icon: Bell },
  { href: '/school/messages', label: 'Messages', icon: MessageSquare, feature: 'MESSAGING' },
  { href: '/school/events', label: 'Calendar', icon: CalendarDays, feature: 'EVENTS' },
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

/** Self-service profile editor: name, phone and a photo URL, available to every signed-in user type. */
function ProfileModal({
  me,
  isPlatform,
  onClose,
  onSaved,
}: {
  me: any;
  isPlatform: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [f, setF] = useState<any>({
    firstName: me.user.firstName ?? '',
    lastName: me.user.lastName ?? '',
    name: me.user.name ?? '',
    phone: me.user.phone ?? '',
    avatarUrl: me.user.avatarUrl ?? '',
    bio: me.user.bio ?? '',
    address: me.user.address ?? '',
    dateOfBirth: me.user.dateOfBirth ? String(me.user.dateOfBirth).slice(0, 10) : '',
  });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await api.patch('/users/me', f);
      toast.success('Profile updated');
      onSaved();
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
      title="My profile"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={busy}>
            Save
          </Button>
        </>
      }
    >
      <div className="mb-4">
        <ImageUpload value={f.avatarUrl} onChange={(dataUrl) => setF({ ...f, avatarUrl: dataUrl })} />
        {!f.avatarUrl && <p className="mt-1 text-xs text-slate-400">No photo yet — your initials show instead</p>}
      </div>
      {isPlatform ? (
        <Field label="Name">
          <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="First name">
            <Input value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} />
          </Field>
          <Field label="Last name">
            <Input value={f.lastName} onChange={(e) => setF({ ...f, lastName: e.target.value })} />
          </Field>
          <Field label="Phone">
            <Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
          </Field>
          <Field label="Date of birth">
            <Input
              type="date"
              value={f.dateOfBirth}
              onChange={(e) => setF({ ...f, dateOfBirth: e.target.value })}
            />
          </Field>
          <Field label="Address" className="sm:col-span-2">
            <Input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
          </Field>
          <Field label="About" className="sm:col-span-2" hint="A line or two others on your team might see">
            <Textarea
              value={f.bio}
              onChange={(e) => setF({ ...f, bio: e.target.value })}
              className="min-h-[70px]"
            />
          </Field>
        </div>
      )}
    </Modal>
  );
}

export function AppShell({ children, mode }: { children: React.ReactNode; mode: 'school' | 'platform' }) {
  const { me, loading, logout, can, has, role, refresh } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
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
  const quickLinks = useMemo(() => {
    const source = role === 'parent' || role === 'student' ? PORTAL_QUICK_LINKS : QUICK_LINKS;
    return source.filter((i) => (!i.perms || can(...i.perms)) && (!i.feature || has(i.feature)));
  }, [role, can, has]);
  const [quickOpen, setQuickOpen] = useState(false);

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
        <div className="relative">
          <button
            onClick={() => setAccountOpen((v) => !v)}
            className="flex w-full items-center gap-2 rounded-lg p-1.5 text-left hover:bg-slate-100"
          >
            {me.user.avatarUrl ? (
              <img src={me.user.avatarUrl} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
            ) : (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand-dark text-xs font-semibold text-white shadow-sm">
                {(me.user.name ?? `${me.user.firstName ?? ''} ${me.user.lastName ?? ''}`)
                  .split(' ')
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((s: string) => s[0]?.toUpperCase())
                  .join('') || '?'}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-800">
                {me.user.name ?? `${me.user.firstName} ${me.user.lastName}`}
              </p>
              <p className="truncate text-xs text-slate-500">{me.roles?.join(', ') ?? me.user.role}</p>
            </div>
            <ChevronDown size={14} className={clsx('shrink-0 text-slate-400 transition-transform', accountOpen && 'rotate-180')} />
          </button>
          {accountOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setAccountOpen(false)} />
              <div className="absolute bottom-full left-0 z-50 mb-2 w-full min-w-[13rem] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
                <button
                  onClick={() => {
                    setAccountOpen(false);
                    setProfileOpen(true);
                  }}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                >
                  <UserCircle size={16} className="text-slate-400" />
                  My profile
                </button>
                <div className="h-px bg-slate-100" />
                <button
                  onClick={logout}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-red-600 hover:bg-red-50"
                >
                  <LogOut size={16} />
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      {profileOpen && (
        <ProfileModal
          me={me}
          isPlatform={mode === 'platform'}
          onClose={() => setProfileOpen(false)}
          onSaved={refresh}
        />
      )}
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
          {mode === 'school' && quickLinks.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setQuickOpen((v) => !v)}
                className="flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1.5 text-xs font-semibold text-brand-dark hover:bg-brand-soft/80"
              >
                <Zap size={14} />
                Quick actions
                <ChevronDown size={13} className={clsx('transition-transform', quickOpen && 'rotate-180')} />
              </button>
              {quickOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setQuickOpen(false)} />
                  <div className="absolute right-0 z-50 mt-2 grid w-64 grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                    {quickLinks.map((q) => (
                      <Link
                        key={q.href}
                        href={q.href}
                        onClick={() => setQuickOpen(false)}
                        className="flex flex-col items-center gap-1.5 rounded-lg p-2.5 text-center text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                      >
                        <q.icon size={18} className="text-brand" />
                        {q.label}
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
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
