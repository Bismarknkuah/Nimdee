import { csv, decMax, decMin, money, pad, paginate, slugify, toDateOnly, zero, addDays, isoDate } from './utils';

describe('money helpers', () => {
  it('normalises numbers, strings and decimals to 2dp', () => {
    expect(money(12.345).toFixed(2)).toBe('12.35');
    expect(money('7.1').toFixed(2)).toBe('7.10');
    expect(money(null).toFixed(2)).toBe('0.00');
    expect(money(money(3)).toFixed(2)).toBe('3.00');
  });
  it('rounds half up like a cashier would', () => {
    expect(money(0.005).toFixed(2)).toBe('0.01');
    expect(money(2.675).toFixed(2)).toBe('2.68');
  });
  it('decMin / decMax compare decimals regardless of runtime', () => {
    expect(decMin(money(5), money(3)).toFixed(2)).toBe('3.00');
    expect(decMax(money(5), 9).toFixed(2)).toBe('9.00');
    expect(decMax(money(-1), 0).toFixed(2)).toBe('0.00');
    expect(zero().isZero()).toBe(true);
  });
});

describe('ids, slugs and paging', () => {
  it('pads sequence numbers', () => {
    expect(pad(7, 6)).toBe('000007');
    expect(pad(123456, 6)).toBe('123456');
  });
  it('slugifies school names safely', () => {
    expect(slugify('Bright Future Academy!')).toBe('bright-future-academy');
    expect(slugify("  St. Mary's   JHS ")).toBe('st-mary-s-jhs');
  });
  it('clamps pagination', () => {
    expect(paginate(0, 5000)).toMatchObject({ page: 1, pageSize: 200 });
    expect(paginate(3, 25)).toMatchObject({ skip: 50, take: 25 });
  });
});

describe('dates and CSV', () => {
  it('converts to date-only UTC midnight', () => {
    expect(toDateOnly('2026-09-16').toISOString()).toBe('2026-09-16T00:00:00.000Z');
    expect(isoDate(addDays(toDateOnly('2026-01-31'), 1))).toBe('2026-02-01');
  });
  it('escapes commas, quotes and newlines in CSV', () => {
    const out = csv([{ name: 'Adjei, Kofi', note: 'Said "hi"\nthen left', n: 3 }]);
    expect(out.split('\n')[0]).toBe('name,note,n');
    expect(out).toContain('"Adjei, Kofi"');
    expect(out).toContain('"Said ""hi""\nthen left"');
  });
});
