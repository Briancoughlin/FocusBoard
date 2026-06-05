/**
 * Tests for the getWeekDays(offsetWeeks) function from components/WeekView.tsx
 * The function is copied here since it is not exported from the module.
 */

import { describe, test, expect } from 'vitest';

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

describe('basic navigation', () => {
  test('getWeekDays(0) returns 7 days starting from Monday of current week', () => {
    const days = getWeekDays(0);
    expect(days).toHaveLength(7);
    // First day must be Monday (getDay() === 1)
    expect(days[0].getDay()).toBe(1);
  });

  test('getWeekDays(1) returns next week\'s 7 days', () => {
    const thisWeek = getWeekDays(0);
    const nextWeek = getWeekDays(1);
    expect(nextWeek).toHaveLength(7);
    // Next week's Monday should be 7 days after this week's Monday
    const diffMs = nextWeek[0].getTime() - thisWeek[0].getTime();
    expect(diffMs).toBe(7 * 24 * 60 * 60 * 1000);
  });

  test('getWeekDays(-1) returns last week\'s 7 days', () => {
    const thisWeek = getWeekDays(0);
    const lastWeek = getWeekDays(-1);
    expect(lastWeek).toHaveLength(7);
    // Last week's Monday should be 7 days before this week's Monday
    const diffMs = thisWeek[0].getTime() - lastWeek[0].getTime();
    expect(diffMs).toBe(7 * 24 * 60 * 60 * 1000);
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

  test('all 7 days are consecutive (each day is exactly 24h after previous)', () => {
    const days = getWeekDays(0);
    for (let i = 1; i < days.length; i++) {
      const diffMs = days[i].getTime() - days[i - 1].getTime();
      // Allow 23h–25h to handle DST transitions gracefully
      expect(diffMs).toBeGreaterThanOrEqual(23 * 60 * 60 * 1000);
      expect(diffMs).toBeLessThanOrEqual(25 * 60 * 60 * 1000);
    }
  });
});

describe('edge cases', () => {
  test('works across month boundaries', () => {
    // Find an offset that causes week to span a month boundary.
    // Use a fixed reference: pick an offset so Monday falls on the last day of a month.
    // We just verify that all 7 days are valid dates with increasing times.
    for (const offset of [-10, 10, 52, -52]) {
      const days = getWeekDays(offset);
      expect(days).toHaveLength(7);
      for (let i = 1; i < days.length; i++) {
        expect(days[i].getTime()).toBeGreaterThan(days[i - 1].getTime());
      }
    }
  });

  test('works across year boundaries', () => {
    // Large positive offset pushes into next year(s), large negative into prior years.
    for (const offset of [-60, 60]) {
      const days = getWeekDays(offset);
      expect(days).toHaveLength(7);
      expect(days[0].getDay()).toBe(1); // still Monday
      expect(days[6].getDay()).toBe(0); // still Sunday
    }
  });
});
