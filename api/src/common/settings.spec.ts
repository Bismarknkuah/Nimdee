import { DEFAULT_SETTINGS, mergeSettings, validateSettings } from './settings';

describe('rules engine', () => {
  const base = () => JSON.parse(JSON.stringify(DEFAULT_SETTINGS));

  it('accepts the defaults', () => {
    expect(() => validateSettings(base())).not.toThrow();
  });
  it('rejects weights that do not total 100', () => {
    const s = base();
    s.academic.caWeight = 40;
    s.academic.examWeight = 70;
    expect(() => validateSettings(s)).toThrow(/add up to 100/);
  });
  it('rejects malformed grade bands', () => {
    const s = base();
    s.academic.gradingScheme = [{ grade: 'A', min: 90, max: 80, remark: 'x' }];
    expect(() => validateSettings(s)).toThrow(/Invalid grade band/);
  });
  it('rejects unknown approval levels and conflict policies', () => {
    const s = base();
    s.academic.resultApprovalLevels = ['SIGN'];
    expect(() => validateSettings(s)).toThrow(/REVIEW and APPROVE/);
    const t = base();
    t.sync.conflictPolicy = 'RANDOM';
    expect(() => validateSettings(t)).toThrow(/conflict policy/);
  });
  it('deep-merges stored settings over defaults', () => {
    const m: any = mergeSettings({ finance: { invoicePrefix: 'BFA' } });
    expect(m.finance.invoicePrefix).toBe('BFA');
    expect(m.finance.receiptPrefix).toBe(DEFAULT_SETTINGS.finance.receiptPrefix);
    expect(m.academic.gradingScheme.length).toBeGreaterThan(0);
  });
});
