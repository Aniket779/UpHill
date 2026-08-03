const {
  todayLocalString,
  parseYmdLocal,
  addDaysYmd,
  ymdOffset,
  weekStartMondayLocal,
  lastNDayStrings,
} = require('../src/lib/dates');

describe('lib/dates', () => {
  it('todayLocalString matches a manually computed local YYYY-MM-DD', () => {
    const d = new Date();
    const expected = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    expect(todayLocalString()).toBe(expected);
  });

  it('parseYmdLocal round-trips through addDaysYmd(x, 0)', () => {
    expect(addDaysYmd('2026-03-15', 0)).toBe('2026-03-15');
  });

  it('addDaysYmd adds and subtracts days correctly', () => {
    expect(addDaysYmd('2026-03-15', 1)).toBe('2026-03-16');
    expect(addDaysYmd('2026-03-15', -1)).toBe('2026-03-14');
  });

  it('addDaysYmd crosses a month boundary forward', () => {
    expect(addDaysYmd('2026-01-31', 1)).toBe('2026-02-01');
  });

  it('addDaysYmd crosses a month boundary backward', () => {
    expect(addDaysYmd('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('addDaysYmd crosses a year boundary', () => {
    expect(addDaysYmd('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('addDaysYmd handles a leap-year February correctly', () => {
    // 2028 is a leap year
    expect(addDaysYmd('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDaysYmd('2028-02-29', 1)).toBe('2028-03-01');
  });

  it('ymdOffset(0) is today', () => {
    expect(ymdOffset(0)).toBe(todayLocalString());
  });

  it('ymdOffset(n) matches addDaysYmd(today, -n)', () => {
    expect(ymdOffset(5)).toBe(addDaysYmd(todayLocalString(), -5));
  });

  it('weekStartMondayLocal returns the same Monday for every day in that week', () => {
    // 2026-03-16 is a Monday
    const monday = new Date(2026, 2, 16);
    const wednesday = new Date(2026, 2, 18);
    const sunday = new Date(2026, 2, 22); // still the same week (Mon–Sun)
    expect(weekStartMondayLocal(monday)).toBe('2026-03-16');
    expect(weekStartMondayLocal(wednesday)).toBe('2026-03-16');
    expect(weekStartMondayLocal(sunday)).toBe('2026-03-16');
  });

  it('weekStartMondayLocal rolls a Sunday back to the *previous* Monday, not forward', () => {
    const sunday = new Date(2026, 2, 22);
    expect(weekStartMondayLocal(sunday)).toBe('2026-03-16');
  });

  it('lastNDayStrings(7) returns 7 consecutive days ending today, oldest first', () => {
    const days = lastNDayStrings(7);
    expect(days).toHaveLength(7);
    expect(days[6]).toBe(todayLocalString());
    for (let i = 1; i < days.length; i += 1) {
      expect(addDaysYmd(days[i - 1], 1)).toBe(days[i]);
    }
  });

  it('parseYmdLocal produces a Date whose components match the input', () => {
    const d = parseYmdLocal('2026-07-04');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(6); // 0-indexed
    expect(d.getDate()).toBe(4);
  });
});
