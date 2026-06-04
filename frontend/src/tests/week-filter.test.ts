/**
 * Tests for the baseWeekTasks filter logic from FocusView.tsx
 */

import { describe, test, expect } from 'vitest';
import type { Task } from '../types';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Test task',
    source: 'jira',
    status: 'todo',
    sourceId: '1',
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Recreates the baseWeekTasks filter logic from FocusView.tsx
 */
function baseWeekFilter(tasks: Task[], pinnedIds: Set<string>): Task[] {
  const endOfWeek = new Date();
  endOfWeek.setDate(endOfWeek.getDate() + (7 - endOfWeek.getDay()));
  endOfWeek.setHours(23, 59, 59, 999);

  return tasks
    .filter(t => t.status !== 'wontdo')
    .filter(t => {
      if (pinnedIds.has(t.id)) return true;
      if (t.source === 'paste') return true;
      if (t.dueDate) return new Date(t.dueDate) <= endOfWeek;
      return t.source === 'jira' && t.priority === 'high';
    });
}

describe('baseWeekTasks filter', () => {
  test('pinned task with no due date is included', () => {
    const task = makeTask({ id: 'pinned-1', source: 'jira', priority: 'low' });
    const result = baseWeekFilter([task], new Set(['pinned-1']));
    expect(result).toHaveLength(1);
  });

  test('paste task with no due date is included', () => {
    const task = makeTask({ source: 'paste' });
    const result = baseWeekFilter([task], new Set());
    expect(result).toHaveLength(1);
  });

  test('task with due date this week is included', () => {
    const task = makeTask({ dueDate: daysFromNow(2) });
    const result = baseWeekFilter([task], new Set());
    expect(result).toHaveLength(1);
  });

  test('task with due date next week is excluded', () => {
    const task = makeTask({ dueDate: daysFromNow(10) });
    const result = baseWeekFilter([task], new Set());
    expect(result).toHaveLength(0);
  });

  test('high priority Jira with no due date is included', () => {
    const task = makeTask({ source: 'jira', priority: 'high' });
    const result = baseWeekFilter([task], new Set());
    expect(result).toHaveLength(1);
  });

  test('medium priority Jira with no due date is excluded', () => {
    const task = makeTask({ source: 'jira', priority: 'medium' });
    const result = baseWeekFilter([task], new Set());
    expect(result).toHaveLength(0);
  });

  test('wontdo task is excluded regardless', () => {
    const task = makeTask({ id: 'pinned-1', source: 'paste', status: 'wontdo' });
    const result = baseWeekFilter([task], new Set(['pinned-1']));
    expect(result).toHaveLength(0);
  });
});
