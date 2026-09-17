import { money } from '../common/utils';
import { splitInstallments } from './fees.service';

describe('splitInstallments', () => {
  const firstDue = new Date('2026-09-15T00:00:00Z');
  const termEnd = new Date('2026-12-15T00:00:00Z');

  it('splits evenly and puts rounding remainder on the last installment', () => {
    const parts = splitInstallments(money(1000), 3, firstDue, termEnd);
    expect(parts.map((p) => p.amount.toFixed(2))).toEqual(['333.33', '333.33', '333.34']);
    expect(parts.reduce((a, p) => a.plus(p.amount), money(0)).toFixed(2)).toBe('1000.00');
    expect(parts.map((p) => p.sequence)).toEqual([1, 2, 3]);
  });
  it('spreads due dates across the term', () => {
    const parts = splitInstallments(money(300), 3, firstDue, termEnd);
    expect(parts[0].dueDate.toISOString()).toBe(firstDue.toISOString());
    expect(parts[1].dueDate.getTime()).toBeGreaterThan(firstDue.getTime());
    expect(parts[2].dueDate.getTime()).toBeLessThanOrEqual(termEnd.getTime());
  });
  it('single installment is due on the due date', () => {
    const parts = splitInstallments(money(450.5), 1, firstDue, termEnd);
    expect(parts).toHaveLength(1);
    expect(parts[0].amount.toFixed(2)).toBe('450.50');
  });
});
