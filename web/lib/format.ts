import { format, formatDistanceToNow, parseISO } from 'date-fns';

export const money = (v: any, currency = 'GHS') =>
  `${currency} ${Number(v ?? 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const num = (v: any) => Number(v ?? 0).toLocaleString();
export const pct = (v: any) => `${Number(v ?? 0).toFixed(1)}%`;
const parse = (d: any) => (d instanceof Date ? d : typeof d === 'string' ? parseISO(d) : new Date(d));
export const fmtDate = (d: any) => (d ? format(parse(d), 'dd MMM yyyy') : '—');
export const fmtDateTime = (d: any) => (d ? format(parse(d), 'dd MMM yyyy, HH:mm') : '—');
export const ago = (d: any) => (d ? formatDistanceToNow(parse(d), { addSuffix: true }) : '—');
export const todayIso = () => new Date().toISOString().slice(0, 10);
export const initials = (first?: string, last?: string) =>
  `${(first ?? '')[0] ?? ''}${(last ?? '')[0] ?? ''}`.toUpperCase();
export const title = (s?: string | null) =>
  (s ?? '')
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
export const DAYS = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
