import { randomBytes } from 'crypto';
import { Decimal, DecimalType, isDecimal } from './prisma-runtime';

export { Decimal, isDecimal };
export type Dec = DecimalType;
/** Normalises any numeric input (number, string, Decimal from any runtime) to a 2dp Decimal. */
/** Rounding mode constants (numeric so they work with every decimal.js build). */
export const ROUND_DOWN = 1;
export const ROUND_HALF_UP = 4;
export const money = (v: any): DecimalType =>
  new Decimal(v === null || v === undefined ? 0 : typeof v === 'object' ? v.toString() : v).toDecimalPlaces(
    2,
    ROUND_HALF_UP,
  );
export const decMin = (a: DecimalType, b: DecimalType): DecimalType => (a.lte(b) ? a : b);
export const decMax = (a: DecimalType, b: DecimalType | number): DecimalType => (a.gte(b) ? a : new Decimal(b));
export const zero = (): DecimalType => new Decimal(0);

export const pad = (n: number, width = 6) => String(n).padStart(width, '0');

export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'school'
  );
}

export function randomPassword(len = 10): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = randomBytes(len);
  return Array.from(bytes, (b) => chars[b % chars.length]).join('') + '!';
}

export function randomToken(bytes = 24): string {
  return randomBytes(bytes).toString('hex');
}

/** Parse YYYY-MM-DD into a UTC date (date-only semantics). */
export function toDateOnly(input: string | Date): Date {
  if (input instanceof Date) return new Date(Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate()));
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(input);
  if (!m) throw new Error(`Invalid date: ${input}`);
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
}

export const isoDate = (d: Date) => d.toISOString().slice(0, 10);
export const startOfToday = () => toDateOnly(new Date());
export const addDays = (d: Date, days: number) => new Date(d.getTime() + days * 86400000);

/** Strip Prisma Decimal/Date wrappers so a value can be stored as JSON. */
export function toJson<T = any>(value: any): T {
  return JSON.parse(JSON.stringify(value, (_k, v) => (isDecimal(v) ? Number(v) : v)));
}

/** Atomic per-scope counter (scope = tenantId or "PLATFORM"). Safe under concurrency. */
export async function nextSequence(db: { $queryRaw: any }, scope: string, key: string): Promise<number> {
  const rows: Array<{ value: number }> = await db.$queryRaw`
    INSERT INTO "Sequence" ("scope", "key", "value") VALUES (${scope}, ${key}, 1)
    ON CONFLICT ("scope", "key") DO UPDATE SET "value" = "Sequence"."value" + 1
    RETURNING "value"`;
  return Number(rows[0].value);
}

export function csv(rows: Record<string, any>[], columns?: string[]): string {
  if (!rows.length) return columns ? columns.join(',') + '\n' : '';
  const cols = columns ?? Object.keys(rows[0]);
  const esc = (v: any) => {
    if (v === null || v === undefined) return '';
    if (v instanceof Date) return v.toISOString();
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n') + '\n';
}

export function paginate(page?: number, pageSize?: number) {
  const take = Math.min(Math.max(Number(pageSize) || 25, 1), 200);
  const p = Math.max(Number(page) || 1, 1);
  return { skip: (p - 1) * take, take, page: p, pageSize: take };
}

/** Currency formatting for messages and PDFs (e.g. "GHS 1,250.00"). */
export const fmtMoney = (v: any, currency = 'GHS') =>
  `${currency} ${Number(v ?? 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
