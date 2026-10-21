/**
 * Tests for the getWeekDays(offsetWeeks) function from components/WeekView.tsx
 * The function is copied here since it is not exported from the module.
 *
 * The clock is frozen with vi.setSystemTime and the timezone is pinned to
 * Europe/London, so results do not depend on the day the suite runs or on the
 * machine's zone. Assertions compare calendar dates (Y-M-D), not millisecond
 * offsets, because a week that contains a DST change is 167h or 169h long.
 */

import { describe, test, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';

// Copied from WeekView.tsx
function getWeekDays(offsetWeeks = 0): Date[] {
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7) + offsetWeeks * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

/** Local calendar date as YYYY-MM-DD. */
function ymd(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Whole calendar days between two local dates, immune to DST hour shifts. */
function calendarDaysBetween(a: Date, b: Date): number {
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((utcB - utcA) / (24 * 60 * 60 * 1000));
}

// The app tsconfig has no Node types, so reach process.env through a narrow cast.
const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } })
  .process.env;
const originalTZ = env.TZ;

beforeAll(() => {
  env.TZ = 'Europe/London';
  vi.useFakeTimers({ toFake: ['Date'] });
  // Default "today": Wednesday 14 Oct 2026, mid-afternoon, no DST nearby.
  vi.setSystemTime(new Date('2026-10-14T15:30:00Z'));
});

afterEach(() => {
  vi.setSystemTime(new Date('2026-10-14T15:30:00Z'));
});

afterAll(() => {
  vi.useRealTimers();
  if (originalTZ === undefined) delete env.TZ;
  else env.TZ = originalTZ;
});

describe('basic navigation', () => {
  test('getWeekDays(0) returns 7 days starting from Monday of current week', () => {
    const days = getWeekDays(0);
    expect(days).toHaveLength(7);
    expect(days[0].getDay()).toBe(1);
    expect(ymd(days[0])).toBe('2026-10-12');
  });

  test('getWeekDays(1) returns next week\'s 7 days', () => {
    const thisWeek = getWeekDays(0);
    const nextWeek = getWeekDays(1);
    expect(nextWeek).toHaveLength(7);
    expect(calendarDaysBetween(thisWeek[0], nextWeek[0])).toBe(7);
    expect(nextWeek.map(ymd)).toEqual([
      '2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22',
      '2026-10-23', '2026-10-24', '2026-10-25',
    ]);
  });

  test('getWeekDays(-1) returns last week\'s 7 days', () => {
    const thisWeek = getWeekDays(0);
    const lastWeek = getWeekDays(-1);
    expect(lastWeek).toHaveLength(7);
    expect(calendarDaysBetween(lastWeek[0], thisWeek[0])).toBe(7);
    expect(ymd(lastWeek[0])).toBe('2026-10-05');
  });
});

describe('day correctness', () => {
  test('first day of week is always Monday (getDay() === 1)', () => {
    for (const offset of [-2, -1, 0, 1, 2]) {
      const days = getWeekDays(offset);
      expect(days[0].getDay()).toBe(1);
    }
  });

  test('last day of week (7th element) is always Sunday (getDay() === 0)', () => {
    for (const offset of [-2, -1, 0, 1, 2]) {
      const days = getWeekDays(offset);
      expect(days[6].getDay()).toBe(0);
    }
  });

  test('all 7 days are consecutive calendar dates', () => {
    const days = getWeekDays(0);
    for (let i = 1; i < days.length; i++) {
      expect(calendarDaysBetween(days[i - 1], days[i])).toBe(1);
    }
  });
});

describe('DST transitions (Europe/London)', () => {
  test('week containing the autumn change (BST ends Sun 25 Oct 2026) is Mon 19 – Sun 25', () => {
    vi.setSystemTime(new Date('2026-10-21T12:00:00Z'));
    const days = getWeekDays(0);
    expect(days.map(ymd)).toEqual([
      '2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22',
      '2026-10-23', '2026-10-24', '2026-10-25',
    ]);
    // Sunday 25 Oct is after the clocks go back, so its offset differs from Monday's.
    expect(days[6].getTimezoneOffset()).not.toBe(days[0].getTimezoneOffset());
  });

  test('stepping forward across the autumn change lands on the next Monday', () => {
    vi.setSystemTime(new Date('2026-10-21T12:00:00Z'));
    const nextWeek = getWeekDays(1);
    expect(ymd(nextWeek[0])).toBe('2026-10-26');
    expect(nextWeek[0].getDay()).toBe(1);
    expect(calendarDaysBetween(getWeekDays(0)[0], nextWeek[0])).toBe(7);
  });

  test('week containing the spring change (BST starts Sun 29 Mar 2026) is Mon 23 – Sun 29', () => {
    vi.setSystemTime(new Date('2026-03-25T12:00:00Z'));
    const days = getWeekDays(0);
    expect(days.map(ymd)).toEqual([
      '2026-03-23', '2026-03-24', '2026-03-25', '2026-03-26',
      '2026-03-27', '2026-03-28', '2026-03-29',
    ]);
    expect(days[6].getTimezoneOffset()).not.toBe(days[0].getTimezoneOffset());
  });

  test('stepping across the spring change in both directions stays on Mondays', () => {
    vi.setSystemTime(new Date('2026-03-25T12:00:00Z'));
    expect(ymd(getWeekDays(1)[0])).toBe('2026-03-30');
    vi.setSystemTime(new Date('2026-04-01T12:00:00Z'));
    expect(ymd(getWeekDays(-1)[0])).toBe('2026-03-23');
  });

  test('late-evening "today" on a DST Sunday still resolves to that week', () => {
    // 23:30 local on Sun 25 Oct 2026 (GMT after the change).
    vi.setSystemTime(new Date('2026-10-25T23:30:00Z'));
    const days = getWeekDays(0);
    expect(ymd(days[0])).toBe('2026-10-19');
    expect(ymd(days[6])).toBe('2026-10-25');
  });
});

describe('edge cases', () => {
  test('works across month boundaries', () => {
    // Today = Wed 28 Oct 2026, so the week runs Mon 26 Oct – Sun 1 Nov.
    vi.setSystemTime(new Date('2026-10-28T12:00:00Z'));
    const days = getWeekDays(0);
    expect(ymd(days[0])).toBe('2026-10-26');
    expect(ymd(days[6])).toBe('2026-11-01');
    for (const offset of [-10, 10, 52, -52]) {
      const week = getWeekDays(offset);
      expect(week).toHaveLength(7);
      for (let i = 1; i < week.length; i++) {
        expect(calendarDaysBetween(week[i - 1], week[i])).toBe(1);
      }
    }
  });

  test('works across year boundaries', () => {
    // Today = Wed 30 Dec 2026, so the week runs Mon 28 Dec 2026 – Sun 3 Jan 2027.
    vi.setSystemTime(new Date('2026-12-30T12:00:00Z'));
    const days = getWeekDays(0);
    expect(ymd(days[0])).toBe('2026-12-28');
    expect(ymd(days[6])).toBe('2027-01-03');
    for (const offset of [-60, 60]) {
      const week = getWeekDays(offset);
      expect(week).toHaveLength(7);
      expect(week[0].getDay()).toBe(1);
      expect(week[6].getDay()).toBe(0);
    }
  });
});
