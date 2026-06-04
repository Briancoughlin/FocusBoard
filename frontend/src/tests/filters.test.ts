/**
 * Tests for task filtering logic from App.tsx
 * applyOverrides, applyDueDateOverrides, and done-date filter logic.
 */

import { describe, test, expect } from 'vitest';
import type { Task, Status } from '../types';

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

// Copied from App.tsx
function applyOverrides(tasks: Task[], overrides: Record<string, Status>): Task[] {
  return tasks.map(task =>
    overrides[task.id] ? { ...task, status: overrides[task.id] } : task
  );
}

// Copied from App.tsx
function applyDueDateOverrides(tasks: Task[], dueDateOverrides: Record<string, string>): Task[] {
  return tasks.map(task =>
    dueDateOverrides[task.id] ? { ...task, dueDate: dueDateOverrides[task.id] } : task
  );
}

describe('applyOverrides', () => {
  test('task with override gets new status', () => {
    const task = makeTask({ id: 'task-1', status: 'todo' });
    const result = applyOverrides([task], { 'task-1': 'inprogress' });
    expect(result[0].status).toBe('inprogress');
  });

  test('task without override keeps original status', () => {
    const task = makeTask({ id: 'task-1', status: 'todo' });
    const result = applyOverrides([task], { 'task-2': 'done' });
    expect(result[0].status).toBe('todo');
  });
});

describe('applyDueDateOverrides', () => {
  test('task with due date override gets new date', () => {
    const task = makeTask({ id: 'task-1', dueDate: '2025-01-01' });
    const result = applyDueDateOverrides([task], { 'task-1': '2025-06-15' });
    expect(result[0].dueDate).toBe('2025-06-15');
  });

  test('task without override keeps original due date', () => {
    const task = makeTask({ id: 'task-1', dueDate: '2025-01-01' });
    const result = applyDueDateOverrides([task], { 'task-2': '2025-06-15' });
    expect(result[0].dueDate).toBe('2025-01-01');
  });
});

describe('done-date filter logic', () => {
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();

  function doneDateFilter(task: Task, doneDates: Record<string, string>): boolean {
    return task.status === 'wontdo' || task.status !== 'done' || doneDates[task.id] === today;
  }

  test('done task from today is kept', () => {
    const task = makeTask({ id: 'task-1', status: 'done' });
    const doneDates = { 'task-1': today };
    expect(doneDateFilter(task, doneDates)).toBe(true);
  });

  test('done task from yesterday is filtered out', () => {
    const task = makeTask({ id: 'task-1', status: 'done' });
    const doneDates = { 'task-1': yesterday };
    expect(doneDateFilter(task, doneDates)).toBe(false);
  });

  test('wontdo task is always kept', () => {
    const task = makeTask({ id: 'task-1', status: 'wontdo' });
    const doneDates = { 'task-1': yesterday };
    expect(doneDateFilter(task, doneDates)).toBe(true);
  });
});
