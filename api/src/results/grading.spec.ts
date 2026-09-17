import { DEFAULT_SETTINGS } from '../common/settings';
import { denseRank, gradeFor, weightedPercent } from './grading';

const scheme = DEFAULT_SETTINGS.academic.gradingScheme;

describe('gradeFor (WAEC-style bands)', () => {
  it('maps boundaries to the right grade', () => {
    expect(gradeFor(100, scheme).grade).toBe('A1');
    expect(gradeFor(80, scheme).grade).toBe('A1');
    expect(gradeFor(79.9, scheme).grade).toBe('B2');
    expect(gradeFor(50, scheme).grade).toBe('C6');
    expect(gradeFor(0, scheme).grade).toBe('F9');
  });
  it('falls back to the lowest band for out-of-range scores', () => {
    expect(gradeFor(-5, scheme).grade).toBe('F9');
  });
  it('carries the remark', () => {
    expect(gradeFor(85, scheme).remark).toBeTruthy();
  });
});

describe('denseRank', () => {
  it('ranks highest first and shares positions on ties', () => {
    const items = [
      { id: 'a', v: 90 },
      { id: 'b', v: 75 },
      { id: 'c', v: 90 },
      { id: 'd', v: null as number | null },
    ];
    const r = denseRank(items, (i) => i.v);
    expect(r.get(items[0])).toBe(1);
    expect(r.get(items[2])).toBe(1);
    expect(r.get(items[1])).toBe(2);
    expect(r.has(items[3])).toBe(false);
  });
});

describe('weightedPercent', () => {
  it('weights assessments by their declared weight', () => {
    const p = weightedPercent([
      { score: 10, maxScore: 20, weight: 1 },
      { score: 90, maxScore: 100, weight: 3 },
    ]);
    expect(p).toBeCloseTo((0.5 * 1 + 0.9 * 3) / 4);
  });
  it('returns null with no marks', () => {
    expect(weightedPercent([])).toBeNull();
  });
});
