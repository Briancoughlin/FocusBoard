/**
 * Tests for getUrgencyScore and getUrgencyLevel from TaskCard.tsx
 */

import { describe, test, expect } from 'vitest';
import { getUrgencyScore, getUrgencyLevel } from '../components/TaskCard';
import type { Task } from '../types';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'test-1',
    title: 'Test task',
    source: 'jira',
    status: 'todo',
    sourceId: '1',
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

/** Returns an ISO timestamp string that is exactly `hours` hours from now. */
function hoursFromNow(hours: number): string {
  return new Date(Date.now() + hours * 3600000).toISOString();
}

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

describe('getUrgencyLevel', () => {
  test('task with due date in the past (< 30 days) is overdue', () => {
    const task = makeTask({ dueDate: daysFromNow(-5) });
    expect(getUrgencyLevel(task)).toBe('overdue');
  });

  test('task with due date > 30 days in the past is normal (ancient date filter)', () => {
    const task = makeTask({ dueDate: daysFromNow(-35) });
    expect(getUrgencyLevel(task)).toBe('normal');
  });

  test('task with due date today is today', () => {
    // Use an ISO timestamp 12 hours from now — diff will be ~0.5 days, which
    // is < 1 and >= 0, landing in the 'today' bucket.
    const task = makeTask({ dueDate: hoursFromNow(12) });
    expect(getUrgencyLevel(task)).toBe('today');
  });

  test('task with due date in 2 days is soon', () => {
    const task = makeTask({ dueDate: daysFromNow(2) });
    expect(getUrgencyLevel(task)).toBe('soon');
  });

  test('task with due date in 10 days is normal', () => {
    const task = makeTask({ dueDate: daysFromNow(10) });
    expect(getUrgencyLevel(task)).toBe('normal');
  });

  test('high priority Jira with no due date is soon', () => {
    const task = makeTask({ source: 'jira', priority: 'high' });
    expect(getUrgencyLevel(task)).toBe('soon');
  });

  test('medium priority with no due date is normal', () => {
    const task = makeTask({ source: 'jira', priority: 'medium' });
    expect(getUrgencyLevel(task)).toBe('normal');
  });
});

describe('getUrgencyScore', () => {
  test('overdue task scores lower (more urgent) than future task', () => {
    const overdue = makeTask({ dueDate: daysFromNow(-3) });
    const future = makeTask({ dueDate: daysFromNow(5) });
    expect(getUrgencyScore(overdue)).toBeLessThan(getUrgencyScore(future));
  });

  test('high priority task scores lower than medium priority (no due dates)', () => {
    const high = makeTask({ priority: 'high' });
    const medium = makeTask({ priority: 'medium' });
    expect(getUrgencyScore(high)).toBeLessThan(getUrgencyScore(medium));
  });

  test('older task scores lower than newer task (age-based for Gmail/Slack)', () => {
    const older = makeTask({
      source: 'gmail',
      updatedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    });
    const newer = makeTask({
      source: 'gmail',
      updatedAt: new Date(Date.now() - 1 * 86400000).toISOString(),
    });
    expect(getUrgencyScore(older)).toBeLessThan(getUrgencyScore(newer));
  });
});
