import Link from 'next/link';
import { ArrowRight, CheckCircle2, CloudOff, CreditCard, GraduationCap, ShieldCheck, Smartphone } from 'lucide-react';

const FEATURES = [
  {
    icon: GraduationCap,
    title: 'Academics & results',
    text: 'Classes, subjects, assessments, computed grades and branded report cards with approval workflow.',
  },
  {
    icon: CloudOff,
    title: 'Works offline',
    text: 'Teachers mark attendance without connectivity; changes sync safely and conflicts are resolved by your rules.',
  },
  {
    icon: CreditCard,
    title: 'Fees & payments',
    text: 'Fee structures, installments, discounts, Mobile Money & card payments with receipts and an audited ledger.',
  },
  {
    icon: Smartphone,
    title: 'Parent portal',
    text: 'Parents see attendance, results, fees and canteen wallets, and pay online from their phone.',
  },
  {
    icon: ShieldCheck,
    title: 'Isolated & secure',
    text: 'Every school is isolated at the database layer with row-level security, roles and a full audit trail.',
  },
  {
    icon: CheckCircle2,
    title: 'Your own website',
    text: 'A branded school website on your own domain with online admissions — no developer needed.',
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2 font-semibold text-slate-900">
          <img src="/icon.svg" alt="" className="h-8 w-8" />
          School OS
        </div>
        <nav className="flex items-center gap-2">
          <Link href="/login" className="btn-secondary">
            Sign in
          </Link>
          <Link href="/register" className="btn-primary">
            Register your school
          </Link>
        </nav>
      </header>
      <section className="mx-auto max-w-6xl px-6 pb-16 pt-12 text-center">
        <p className="mb-3 inline-flex rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand-dark">
          Built for schools in Ghana and beyond
        </p>
        <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          The operating system for your school
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
          Admissions, attendance, fees, results, canteen, timetable, communication and a parent portal — one platform
          that keeps working when the internet doesn&apos;t.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/register" className="btn-primary px-5 py-3 text-base">
            Start free trial <ArrowRight size={18} />
          </Link>
          <Link href="/login" className="btn-secondary px-5 py-3 text-base">
            School sign in
          </Link>
        </div>
      </section>
      <section className="bg-slate-50 py-16">
        <div className="mx-auto grid max-w-6xl gap-6 px-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="card p-5">
              <f.icon className="mb-3 text-brand" size={22} />
              <h3 className="font-semibold text-slate-900">{f.title}</h3>
              <p className="mt-1 text-sm text-slate-600">{f.text}</p>
            </div>
          ))}
        </div>
      </section>
      <footer className="mx-auto flex max-w-6xl items-center justify-between px-6 py-8 text-xs text-slate-500">
        <span>© {new Date().getFullYear()} School OS</span>
        <Link href="/platform/login" className="hover:text-slate-800">
          Platform console
        </Link>
      </footer>
    </div>
  );
}
