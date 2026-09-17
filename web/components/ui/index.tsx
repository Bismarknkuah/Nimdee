'use client';
import clsx from 'clsx';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Info,
  Loader2,
  Search,
  X,
  XCircle,
} from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

// ─── Toasts ───
type Toast = { id: number; kind: 'success' | 'error' | 'info'; message: string };
const ToastCtx = createContext<{ push: (kind: Toast['kind'], message: string) => void }>({ push: () => undefined });
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((kind: Toast['kind'], message: string) => {
    const id = Date.now() + Math.random();
    setItems((l) => [...l, { id, kind, message }]);
    setTimeout(() => setItems((l) => l.filter((t) => t.id !== id)), kind === 'error' ? 7000 : 3500);
  }, []);
  const value = useMemo(() => ({ push }), [push]);
  const Icon = { success: CheckCircle2, error: XCircle, info: Info };
  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-80 flex-col gap-2">
        {items.map((t) => {
          const I = Icon[t.kind];
          return (
            <div
              key={t.id}
              className={clsx(
                'pointer-events-auto flex items-start gap-2 rounded-lg border p-3 text-sm shadow-lg',
                t.kind === 'success' && 'border-emerald-200 bg-emerald-50 text-emerald-800',
                t.kind === 'error' && 'border-red-200 bg-red-50 text-red-800',
                t.kind === 'info' && 'border-slate-200 bg-white text-slate-800',
              )}
            >
              <I size={16} className="mt-0.5 shrink-0" />
              <span className="flex-1">{t.message}</span>
              <button onClick={() => setItems((l) => l.filter((x) => x.id !== t.id))}>
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}
export function useToast() {
  const { push } = useContext(ToastCtx);
  return useMemo(
    () => ({
      success: (m: string) => push('success', m),
      error: (m: string | any) => push('error', typeof m === 'string' ? m : (m?.message ?? 'Something went wrong')),
      info: (m: string) => push('info', m),
    }),
    [push],
  );
}

// ─── Primitives ───
export function Button({
  variant = 'primary',
  loading,
  className,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  loading?: boolean;
}) {
  const cls = { primary: 'btn-primary', secondary: 'btn-secondary', danger: 'btn-danger', ghost: 'btn-ghost' }[variant];
  return (
    <button className={clsx(cls, className)} disabled={loading || rest.disabled} {...rest}>
      {loading && <Loader2 size={15} className="animate-spin" />}
      {children}
    </button>
  );
}
export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      {label && <label className="label">{label}</label>}
      {children}
      {error ? (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-slate-400">{hint}</p>
      ) : null}
    </div>
  );
}
export const Input = (p: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input {...p} className={clsx('input', p.className)} />
);
export const Textarea = (p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea {...p} className={clsx('input min-h-[90px]', p.className)} />
);
export function Select({
  options,
  placeholder,
  ...p
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
}) {
  return (
    <select {...p} className={clsx('input', p.className)}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
export function Checkbox({ label, ...p }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input type="checkbox" {...p} className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand" />
      {label}
    </label>
  );
}
export function Card({
  className,
  children,
  title,
  actions,
  padded = true,
}: {
  className?: string;
  children: ReactNode;
  title?: ReactNode;
  actions?: ReactNode;
  padded?: boolean;
}) {
  return (
    <div className={clsx('card', className)}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
          <div className="flex items-center gap-2">{actions}</div>
        </div>
      )}
      <div className={padded ? 'p-4' : ''}>{children}</div>
    </div>
  );
}
const badgeTone: Record<string, string> = {
  ACTIVE: 'emerald',
  PAID: 'emerald',
  PRESENT: 'emerald',
  SUCCESS: 'emerald',
  PUBLISHED: 'emerald',
  APPLIED: 'emerald',
  SYNCED: 'emerald',
  RESOLVED: 'emerald',
  ADMITTED: 'emerald',
  APPROVED: 'emerald',
  VERIFIED: 'emerald',
  PENDING: 'amber',
  PARTIALLY_PAID: 'amber',
  PARTIAL: 'amber',
  LATE: 'amber',
  TRIAL: 'amber',
  SUBMITTED: 'sky',
  REVIEWED: 'sky',
  UNDER_REVIEW: 'sky',
  INTERVIEW: 'sky',
  ASSESSMENT: 'sky',
  GRACE: 'amber',
  PAST_DUE: 'red',
  OVERDUE: 'red',
  ABSENT: 'red',
  FAILED: 'red',
  SUSPENDED: 'red',
  REJECTED: 'red',
  REVERSED: 'red',
  CANCELLED: 'slate',
  CONFLICT: 'red',
  OPEN: 'red',
  OFFLINE: 'slate',
  DISABLED: 'slate',
  DRAFT: 'slate',
  ISSUED: 'sky',
  EXCUSED: 'sky',
  SICK: 'violet',
  INACTIVE: 'slate',
  DUPLICATE: 'slate',
};
export function Badge({ children, tone, className }: { children: ReactNode; tone?: string; className?: string }) {
  const t = tone ?? badgeTone[String(children)] ?? 'slate';
  const map: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    amber: 'bg-amber-50 text-amber-700 ring-amber-600/20',
    red: 'bg-red-50 text-red-700 ring-red-600/20',
    sky: 'bg-sky-50 text-sky-700 ring-sky-600/20',
    violet: 'bg-violet-50 text-violet-700 ring-violet-600/20',
    slate: 'bg-slate-100 text-slate-700 ring-slate-500/20',
    brand: 'bg-brand-soft text-brand-dark ring-brand/20',
  };
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        map[t] ?? map.slate,
        className,
      )}
    >
      {typeof children === 'string' ? children.replace(/_/g, ' ') : children}
    </span>
  );
}
export const Spinner = ({ className }: { className?: string }) => (
  <div className={clsx('flex items-center justify-center py-10 text-slate-400', className)}>
    <Loader2 className="animate-spin" />
  </div>
);
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {description && <p className="mt-1 max-w-sm text-xs text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
export function Alert({
  kind = 'info',
  children,
  className,
}: {
  kind?: 'info' | 'warning' | 'error' | 'success';
  children: ReactNode;
  className?: string;
}) {
  const map = {
    info: 'border-sky-200 bg-sky-50 text-sky-800',
    warning: 'border-amber-200 bg-amber-50 text-amber-800',
    error: 'border-red-200 bg-red-50 text-red-800',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  };
  const I = { info: Info, warning: AlertTriangle, error: XCircle, success: CheckCircle2 }[kind];
  return (
    <div className={clsx('flex items-start gap-2 rounded-lg border p-3 text-sm', map[kind], className)}>
      <I size={16} className="mt-0.5 shrink-0" />
      <div className="flex-1">{children}</div>
    </div>
  );
}
export function PageHeader({
  title,
  subtitle,
  actions,
  back,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  back?: () => void;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-2">
        {back && (
          <button onClick={back} className="mt-0.5 rounded-md p-1 text-slate-500 hover:bg-slate-100">
            <ChevronLeft size={18} />
          </button>
        )}
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'brand',
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: 'brand' | 'emerald' | 'amber' | 'red' | 'sky' | 'violet';
}) {
  const bg = {
    brand: 'bg-brand-soft text-brand-dark',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
    sky: 'bg-sky-50 text-sky-700',
    violet: 'bg-violet-50 text-violet-700',
  }[tone];
  return (
    <div className="card flex items-center gap-4 p-4">
      {icon && <div className={clsx('flex h-11 w-11 shrink-0 items-center justify-center rounded-lg', bg)}>{icon}</div>}
      <div className="min-w-0">
        <p className="truncate text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        <p className="mt-0.5 truncate text-xl font-semibold text-slate-900">{value}</p>
        {hint && <p className="truncate text-xs text-slate-500">{hint}</p>}
      </div>
    </div>
  );
}
export function Tabs({
  tabs,
  value,
  onChange,
}: {
  tabs: Array<{ id: string; label: string; count?: number }>;
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={clsx(
            '-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium',
            value === t.id ? 'border-brand text-brand-dark' : 'border-transparent text-slate-500 hover:text-slate-700',
          )}
        >
          {t.label}
          {t.count !== undefined && <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 text-xs">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  const w = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }[size];
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 pt-16"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={clsx('card w-full', w)}>
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h3 className="font-semibold text-slate-900">{title}</h3>
          <button onClick={onClose} className="rounded-md p-1 text-slate-500 hover:bg-slate-100">
            <X size={16} />
          </button>
        </div>
        <div className="p-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-slate-100 px-4 py-3">{footer}</div>}
      </div>
    </div>
  );
}
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  danger,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-sm text-slate-600">{message}</div>
    </Modal>
  );
}
export function SearchBox({
  value,
  onChange,
  placeholder = 'Search…',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <Search size={15} className="pointer-events-none absolute left-3 top-2.5 text-slate-400" />
      <input
        className="input pl-9"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
export interface Column<T> {
  key: string;
  header: ReactNode;
  render?: (row: T) => ReactNode;
  className?: string;
  align?: 'left' | 'right' | 'center';
}
export function DataTable<T extends { id?: string }>({
  columns,
  rows,
  loading,
  emptyTitle = 'Nothing here yet',
  emptyDescription,
  onRowClick,
  page,
  pageSize = 20,
  total,
  onPage,
  keyField = 'id',
  footer,
}: {
  columns: Column<T>[];
  rows: T[] | null | undefined;
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  onRowClick?: (row: T) => void;
  page?: number;
  pageSize?: number;
  total?: number;
  onPage?: (p: number) => void;
  keyField?: string;
  footer?: ReactNode;
}) {
  const pages = total !== undefined ? Math.max(1, Math.ceil(total / pageSize)) : 1;
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={clsx(
                    c.className,
                    c.align === 'right' && 'text-right',
                    c.align === 'center' && 'text-center',
                  )}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && !rows?.length ? (
              <tr>
                <td colSpan={columns.length}>
                  <Spinner />
                </td>
              </tr>
            ) : !rows?.length ? (
              <tr>
                <td colSpan={columns.length}>
                  <EmptyState title={emptyTitle} description={emptyDescription} />
                </td>
              </tr>
            ) : (
              rows.map((r: any, i) => (
                <tr
                  key={r[keyField] ?? i}
                  onClick={onRowClick ? () => onRowClick(r) : undefined}
                  className={onRowClick ? 'cursor-pointer' : undefined}
                >
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={clsx(
                        c.className,
                        c.align === 'right' && 'text-right',
                        c.align === 'center' && 'text-center',
                      )}
                    >
                      {c.render ? c.render(r) : ((r as any)[c.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {(footer || (total !== undefined && onPage)) && (
        <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
          <span>{footer ?? `${total} record${total === 1 ? '' : 's'}`}</span>
          {total !== undefined && onPage && pages > 1 && (
            <div className="flex items-center gap-1">
              <button
                className="btn-ghost px-2 py-1"
                disabled={(page ?? 1) <= 1}
                onClick={() => onPage((page ?? 1) - 1)}
              >
                <ChevronLeft size={14} />
              </button>
              <span>
                Page {page ?? 1} of {pages}
              </span>
              <button
                className="btn-ghost px-2 py-1"
                disabled={(page ?? 1) >= pages}
                onClick={() => onPage((page ?? 1) + 1)}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
export function Avatar({ name, src, size = 'md' }: { name: string; src?: string | null; size?: 'sm' | 'md' | 'lg' }) {
  const s = { sm: 'h-7 w-7 text-xs', md: 'h-9 w-9 text-sm', lg: 'h-14 w-14 text-lg' }[size];
  const init = name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return src ? (
    <img src={src} alt={name} className={clsx('rounded-full object-cover', s)} />
  ) : (
    <div
      className={clsx('flex items-center justify-center rounded-full bg-brand-soft font-semibold text-brand-dark', s)}
    >
      {init}
    </div>
  );
}
export function Description({ items }: { items: Array<[string, ReactNode]> }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
      {items.map(([k, v]) => (
        <div key={k}>
          <dt className="text-xs font-medium text-slate-500">{k}</dt>
          <dd className="text-sm text-slate-800">{v ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

// ─── Extra building blocks ───
export function ProgressBar({
  value,
  tone = 'brand',
  label,
}: {
  value: number;
  tone?: 'brand' | 'emerald' | 'amber' | 'red' | 'sky';
  label?: string;
}) {
  const v = Math.max(0, Math.min(100, value));
  const bg = {
    brand: 'bg-brand',
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    red: 'bg-red-500',
    sky: 'bg-sky-500',
  }[tone];
  return (
    <div>
      {label && (
        <div className="mb-1 flex justify-between text-xs text-slate-500">
          <span>{label}</span>
          <span>{v}%</span>
        </div>
      )}
      <div className="h-2 w-full rounded-full bg-slate-100">
        <div className={clsx('h-2 rounded-full transition-all', bg)} style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}
export function Timeline({
  items,
}: {
  items: Array<{ id: string; title: ReactNode; meta?: ReactNode; tone?: string; body?: ReactNode }>;
}) {
  const dot: Record<string, string> = {
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    red: 'bg-red-500',
    sky: 'bg-sky-500',
    violet: 'bg-violet-500',
    slate: 'bg-slate-400',
    brand: 'bg-brand',
  };
  return (
    <ol className="relative ml-2 border-l border-slate-200">
      {items.map((it) => (
        <li key={it.id} className="mb-4 ml-4">
          <span
            className={clsx(
              'absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full ring-2 ring-white',
              dot[it.tone ?? 'brand'],
            )}
          />
          <div className="text-sm font-medium text-slate-900">{it.title}</div>
          {it.meta && <div className="text-xs text-slate-500">{it.meta}</div>}
          {it.body && <div className="mt-1 text-sm text-slate-600">{it.body}</div>}
        </li>
      ))}
      {!items.length && <li className="ml-4 text-sm text-slate-500">Nothing yet</li>}
    </ol>
  );
}
export function MonthCalendar({
  year,
  month,
  days,
  onSelect,
  selected,
  onNavigate,
}: {
  year: number;
  month: number;
  days: Record<string, any[]>;
  onSelect?: (date: string) => void;
  selected?: string;
  onNavigate: (year: number, month: number) => void;
}) {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells = [...Array(offset).fill(null), ...Array.from({ length: count }, (_, i) => i + 1)];
  const todayKey = new Date().toISOString().slice(0, 10);
  const tones: Record<string, string> = {
    HOLIDAY: 'bg-emerald-100 text-emerald-800',
    EXAM: 'bg-red-100 text-red-800',
    MEETING: 'bg-sky-100 text-sky-800',
    SPORTS: 'bg-amber-100 text-amber-800',
    CULTURAL: 'bg-violet-100 text-violet-800',
    TRIP: 'bg-orange-100 text-orange-800',
    ACADEMIC: 'bg-brand-soft text-brand-dark',
    OTHER: 'bg-slate-100 text-slate-700',
  };
  const prev = () => (month === 1 ? onNavigate(year - 1, 12) : onNavigate(year, month - 1));
  const next = () => (month === 12 ? onNavigate(year + 1, 1) : onNavigate(year, month + 1));
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2">
        <button onClick={prev} className="btn-ghost px-2">
          <ChevronLeft size={16} />
        </button>
        <p className="font-semibold">
          {first.toLocaleString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })}
        </p>
        <button onClick={next} className="btn-ghost px-2">
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="grid grid-cols-7 border-b border-slate-100 text-center text-[11px] font-semibold uppercase text-slate-500">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((d, i) => {
          const key = d ? `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}` : '';
          const evs = d ? (days[key] ?? []) : [];
          return (
            <div
              key={i}
              onClick={() => d && onSelect?.(key)}
              className={clsx(
                'min-h-[84px] border-b border-r border-slate-100 p-1 text-xs',
                d && onSelect && 'cursor-pointer hover:bg-slate-50',
                selected === key && 'bg-brand-soft/40',
                key === todayKey && 'ring-1 ring-inset ring-brand',
              )}
            >
              {d && (
                <p
                  className={clsx(
                    'mb-1 text-right text-[11px]',
                    key === todayKey ? 'font-bold text-brand' : 'text-slate-500',
                  )}
                >
                  {d}
                </p>
              )}
              {evs.slice(0, 3).map((e: any) => (
                <div key={e.id} className={clsx('mb-0.5 truncate rounded px-1 py-0.5', tones[e.type] ?? tones.OTHER)}>
                  {e.title}
                </div>
              ))}
              {evs.length > 3 && <p className="text-[10px] text-slate-400">+{evs.length - 3} more</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
export function KeyStat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: 'red' | 'emerald' | 'amber' | 'brand';
}) {
  const color = { red: 'text-red-700', emerald: 'text-emerald-700', amber: 'text-amber-700', brand: 'text-brand-dark' }[
    tone ?? 'brand'
  ];
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={clsx('mt-0.5 text-lg font-semibold', color)}>{value}</p>
      {sub && <p className="text-xs text-slate-500">{sub}</p>}
    </div>
  );
}
export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 mt-6 flex items-center justify-between">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{children}</h2>
      {action}
    </div>
  );
}
