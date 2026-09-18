import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  BellRing,
  CalendarCheck2,
  CloudOff,
  CreditCard,
  GraduationCap,
  Layers,
  MessagesSquare,
  Play,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Wallet,
  Wifi,
} from 'lucide-react';

const FEATURES = [
  {
    icon: GraduationCap,
    tone: 'text-blue-600 bg-blue-50',
    title: 'Academics & results',
    text: 'Classes, subjects, assessments and computed grades: letter grades for KG/Primary and the BECE scale for JHS, plus branded report cards and an approval workflow.',
  },
  {
    icon: CloudOff,
    tone: 'text-emerald-600 bg-emerald-50',
    title: 'Works offline',
    text: "Teachers mark attendance without connectivity. Changes queue on the device and sync safely the moment it's back online, with conflicts resolved by your rules.",
  },
  {
    icon: Wallet,
    tone: 'text-amber-600 bg-amber-50',
    title: 'Fees & payments',
    text: 'Fee structures for day and boarding students, installments, discounts, Mobile Money & card payments with receipts and an audited ledger.',
  },
  {
    icon: Smartphone,
    tone: 'text-sky-600 bg-sky-50',
    title: 'Parent portal',
    text: 'Parents see attendance, results, fees, homework and canteen wallets, and can pay online straight from their phone.',
  },
  {
    icon: ShieldCheck,
    tone: 'text-violet-600 bg-violet-50',
    title: 'Isolated & secure',
    text: 'Every school is isolated at the database layer with row-level security, granular roles and a full audit trail of every action.',
  },
  {
    icon: BadgeCheck,
    tone: 'text-rose-600 bg-rose-50',
    title: 'Your own website',
    text: 'A branded school website on your own domain with online admissions built in. No developer needed to launch it.',
  },
];

const STEPS = [
  {
    n: '01',
    title: 'Register your school',
    text: "Tell us your levels (KG, Primary, JHS) and whether you're day, boarding, or both.",
  },
  {
    n: '02',
    title: 'We set it up for you',
    text: 'Standard classes and GES subjects are created automatically, ready in Academics from day one.',
  },
  {
    n: '03',
    title: 'Invite your team',
    text: 'Add teachers, staff and parents. Everyone gets a role-based login on the very same day.',
  },
];

function BrandMark({ dark }: { dark?: boolean }) {
  return (
    <div className={`flex items-center gap-2.5 font-bold ${dark ? 'text-white' : 'text-slate-900'}`}>
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-brand-dark text-white shadow-card">
        <GraduationCap size={19} />
      </span>
      <span className="text-lg tracking-tight">Nimdee</span>
    </div>
  );
}

function DashboardPreview() {
  return (
    <div className="relative">
      <div className="absolute -left-10 -top-10 h-56 w-56 rounded-full bg-brand/20 blur-3xl animate-float" />
      <div className="absolute -bottom-14 -right-8 h-64 w-64 rounded-full bg-emerald-300/25 blur-3xl animate-float-delay" />
      <div className="relative rounded-2xl border border-slate-200/70 bg-white/90 p-2 shadow-2xl shadow-slate-900/10 backdrop-blur">
        <div className="flex items-center gap-1.5 border-b border-slate-100 px-3 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          <span className="ml-3 rounded-md bg-slate-100 px-3 py-0.5 text-[11px] text-slate-400">brightfuture.nimdee.app</span>
        </div>
        <div className="space-y-3 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400">Good morning</p>
              <p className="text-sm font-semibold text-slate-800">Bright Future Academy</p>
            </div>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-soft">
              <BellRing size={14} className="text-brand-dark" />
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            {[
              { label: 'Attendance', value: '96%', tone: 'text-emerald-600' },
              { label: 'Fees collected', value: 'GHS 24.8k', tone: 'text-brand-dark' },
              { label: 'Students', value: '842', tone: 'text-slate-700' },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5">
                <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{s.label}</p>
                <p className={`mt-1 text-base font-bold ${s.tone}`}>{s.value}</p>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-slate-100 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-600">Weekly attendance</p>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-600">On track</span>
            </div>
            <div className="flex h-16 items-end gap-1.5">
              {[62, 78, 55, 88, 70, 95, 84].map((h, i) => (
                <div key={i} className="flex-1 rounded-t-md bg-gradient-to-t from-brand to-brand/60" style={{ height: `${h}%` }} />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2.5 rounded-xl border border-slate-100 p-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600">
              <Wallet size={14} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-slate-700">Kofi A. paid Term 2 fees</p>
              <p className="text-[10px] text-slate-400">Mobile Money · 2 min ago</p>
            </div>
            <span className="shrink-0 text-xs font-semibold text-emerald-600">+GHS 450</span>
          </div>
        </div>
      </div>
      <div className="absolute -left-6 top-16 hidden rounded-xl border border-slate-100 bg-white p-3 shadow-xl sm:block">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <Wifi size={13} />
          </span>
          <div>
            <p className="text-[11px] font-semibold text-slate-700">Synced offline</p>
            <p className="text-[10px] text-slate-400">32 records · just now</p>
          </div>
        </div>
      </div>
      <div className="absolute -right-6 bottom-10 hidden rounded-xl border border-slate-100 bg-white p-3 shadow-xl sm:block">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-50 text-sky-600">
            <MessagesSquare size={13} />
          </span>
          <div>
            <p className="text-[11px] font-semibold text-slate-700">Parent message</p>
            <p className="text-[10px] text-slate-400">&ldquo;Thank you, teacher!&rdquo;</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-white">
      <header className="sticky top-0 z-30 border-b border-slate-100/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <BrandMark />
          <nav className="hidden items-center gap-7 text-sm font-medium text-slate-600 md:flex">
            <a href="#features" className="hover:text-slate-900">
              Features
            </a>
            <a href="#how" className="hover:text-slate-900">
              How it works
            </a>
            <Link href="/platform/login" className="hover:text-slate-900">
              Platform console
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className="btn-secondary hidden sm:inline-flex">
              Sign in
            </Link>
            <Link href="/register" className="btn-primary">
              Register your school
            </Link>
          </div>
        </div>
      </header>

      <section className="relative bg-grid">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[560px] bg-gradient-to-b from-brand-soft/70 via-white to-white" />
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 pb-20 pt-14 lg:grid-cols-[1.05fr,0.95fr] lg:gap-8 lg:pb-28 lg:pt-20">
          <div>
            <p className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-brand/20 bg-brand-soft px-3.5 py-1.5 text-xs font-semibold text-brand-dark">
              <Sparkles size={13} /> Built for KG, Primary &amp; JHS schools in Ghana
            </p>
            <h1 className="max-w-xl text-4xl font-extrabold leading-[1.08] tracking-tight text-slate-900 sm:text-5xl">
              Run your school beautifully <span className="text-brand">online or offline</span>
            </h1>
            <p className="mt-5 max-w-lg text-lg text-slate-600">
              Admissions, attendance, fees, results, canteen, timetable, communication and a parent portal: one
              platform that keeps working when the internet doesn&apos;t.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/register" className="btn-primary px-5 py-3 text-base shadow-lg shadow-brand/25">
                Start free trial <ArrowRight size={18} />
              </Link>
              <Link href="/login?demo=1" className="btn-secondary px-5 py-3 text-base">
                <Play size={16} /> Try the demo school
              </Link>
            </div>
            <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-slate-500">
              <span className="flex items-center gap-1.5">
                <CloudOff size={15} className="text-emerald-500" /> Offline-first attendance
              </span>
              <span className="flex items-center gap-1.5">
                <ShieldCheck size={15} className="text-violet-500" /> Row-level data isolation
              </span>
              <span className="flex items-center gap-1.5">
                <CreditCard size={15} className="text-amber-500" /> Mobile Money &amp; cards
              </span>
            </div>
          </div>
          <DashboardPreview />
        </div>
      </section>

      <section id="features" className="border-t border-slate-100 bg-slate-50/60 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-brand">Everything in one place</p>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">A complete operating system for your school</h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="card group p-6 transition hover:-translate-y-0.5 hover:shadow-lg">
                <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl ${f.tone}`}>
                  <f.icon size={20} />
                </div>
                <h3 className="font-semibold text-slate-900">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how" className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto mb-14 max-w-2xl text-center">
            <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-brand">Get started in minutes</p>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">From registration to your first school day</h2>
          </div>
          <div className="grid gap-8 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <div key={s.n} className="relative pl-2">
                {i < STEPS.length - 1 && (
                  <div className="absolute right-[-1.25rem] top-6 hidden h-px w-8 bg-slate-200 sm:block" />
                )}
                <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">
                  {s.n}
                </span>
                <h3 className="text-lg font-semibold text-slate-900">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand via-brand to-brand-dark px-8 py-14 text-center shadow-xl sm:px-16">
          <Layers className="pointer-events-none absolute -left-6 -top-6 h-32 w-32 text-white/10" />
          <CalendarCheck2 className="pointer-events-none absolute -bottom-6 -right-6 h-32 w-32 text-white/10" />
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Ready to modernize your school?</h2>
          <p className="mx-auto mt-3 max-w-xl text-brand-soft/90">
            Free trial, no card required, or explore every role first with the live demo school.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/register" className="btn bg-white px-5 py-3 text-base text-brand-dark hover:bg-brand-soft">
              Start free trial <ArrowRight size={18} />
            </Link>
            <Link href="/login?demo=1" className="btn border border-white/40 px-5 py-3 text-base text-white hover:bg-white/10">
              Try the demo school
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-100">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            <BrandMark />
            <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-slate-500">
              <Link href="/login" className="hover:text-slate-800">
                School sign in
              </Link>
              <Link href="/register" className="hover:text-slate-800">
                Register a school
              </Link>
              <Link href="/platform/login" className="hover:text-slate-800">
                Platform console
              </Link>
            </nav>
          </div>
          <p className="mt-6 text-center text-xs text-slate-400 sm:text-left">
            © {new Date().getFullYear()} Nimdee · Built for KG, Primary &amp; JHS schools in Ghana
          </p>
        </div>
      </footer>
    </div>
  );
}
