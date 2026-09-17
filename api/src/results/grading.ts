import { GradeBand } from '../common/settings';

/** Maps a percentage score to the school's grade band. Falls back to the lowest band for out-of-range scores. */
export function gradeFor(score: number, scheme: GradeBand[]): { grade: string | null; remark: string | null } {
  const band = scheme.find((b) => score >= b.min && score <= b.max) ?? [...scheme].sort((a, b) => a.min - b.min)[0];
  return { grade: band?.grade ?? null, remark: band?.remark ?? null };
}

/** Dense ranking (1,1,2,3 for ties) of items by a numeric value, highest first. Items with `null` are unranked. */
export function denseRank<T>(items: T[], value: (item: T) => number | null): Map<T, number> {
  const ranked = items.filter((i) => value(i) !== null).sort((a, b) => (value(b) as number) - (value(a) as number));
  const out = new Map<T, number>();
  let pos = 0;
  let prev: number | null = null;
  for (const item of ranked) {
    const v = value(item) as number;
    if (prev === null || v < prev) pos++;
    prev = v;
    out.set(item, pos);
  }
  return out;
}

/** Weighted percentage across assessments of one kind (class score or exam). Returns null when no marks exist. */
export function weightedPercent(entries: Array<{ score: number; maxScore: number; weight: number }>): number | null {
  let wsum = 0,
    acc = 0;
  for (const e of entries) {
    if (!e.maxScore) continue;
    const w = e.weight || 1;
    acc += (e.score / e.maxScore) * w;
    wsum += w;
  }
  return entries.length && wsum > 0 ? acc / wsum : null;
}
