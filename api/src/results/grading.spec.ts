import { DEFAULT_SETTINGS, schemeForLevel } from '../common/settings';
import { denseRank, gradeFor, weightedPercent } from './grading';

// The general default (and JHS specifically) uses the BECE-style 1–9 scale; KG/Primary use letter grades.
const jhsScheme = DEFAULT_SETTINGS.academic.gradingScheme;
const primaryScheme = DEFAULT_SETTINGS.academic.gradingSchemes!.PRIMARY!;

describe('gradeFor (JHS: BECE 1–9 bands)', () => {
  it('maps boundaries to the right grade (1 = highest, 9 = lowest)', () => {
    expect(gradeFor(100, jhsScheme).grade).toBe('1');
    expect(gradeFor(80, jhsScheme).grade).toBe('1');
    expect(gradeFor(79.9, jhsScheme).grade).toBe('2');
    expect(gradeFor(50, jhsScheme).grade).toBe('4');
    expect(gradeFor(0, jhsScheme).grade).toBe('9');
  });
  it('falls back to the lowest band for out-of-range scores', () => {
    expect(gradeFor(-5, jhsScheme).grade).toBe('9');
  });
  it('carries the remark', () => {
    expect(gradeFor(85, jhsScheme).remark).toBeTruthy();
  });
});

describe('gradeFor (KG/Primary: letter bands)', () => {
  it('maps boundaries to letter grades', () => {
    expect(gradeFor(85, primaryScheme).grade).toBe('A');
    expect(gradeFor(65, primaryScheme).grade).toBe('C');
    expect(gradeFor(10, primaryScheme).grade).toBe('F');
  });
});

describe('schemeForLevel', () => {
  it('picks the JHS scheme for a JHS class and the Primary scheme for a Primary class', () => {
    expect(schemeForLevel(DEFAULT_SETTINGS, 'JHS')).toBe(jhsScheme);
    expect(schemeForLevel(DEFAULT_SETTINGS, 'PRIMARY')).toBe(primaryScheme);
  });
  it('falls back to PRIMARY grading for KG when no KG-specific override is set', () => {
    expect(schemeForLevel(DEFAULT_SETTINGS, 'KG')).toBe(DEFAULT_SETTINGS.academic.gradingSchemes!.KG);
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
