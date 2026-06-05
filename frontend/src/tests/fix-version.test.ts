/**
 * Tests for fix version filter logic from App.tsx.
 * Covers quarter pattern matching, task filtering by fixVersion,
 * and deduplication of allFixVersions.
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

// Copied from App.tsx — parameterised so tests can supply a fixed year/quarter
function findCurrentQuarterKey(allFixVersions: string[], year: number, quarter: number): string {
  const yr2 = String(year).slice(2);
  const yr4 = String(year);
  const q = quarter;
  const patterns = [
    new RegExp(`^${yr2}\\.${q}\\b`),        // "26.2"
    new RegExp(`^${yr4}\\.${q}\\b`),        // "2026.2"
    new RegExp(`Q${q}\\s*${yr4}`, 'i'),     // "Q2 2026"
    new RegExp(`Q${q}\\s*${yr2}`, 'i'),     // "Q2 26"
    new RegExp(`R${yr2}\\.${q}\\b`, 'i'),   // "R26.2"
  ];
  return allFixVersions.find(v => patterns.some(p => p.test(v))) ?? 'all';
}

// Copied from App.tsx
function filterTasksByFixVersion(tasks: Task[], effectiveFixVersion: string): Task[] {
  if (effectiveFixVersion === 'all') return tasks;
  return tasks.filter(t =>
    t.source !== 'jira' ||          // keep non-Jira tasks always
    t.fixVersion === effectiveFixVersion
  );
}

// Copied from App.tsx
function buildAllFixVersions(tasks: Task[]): string[] {
  return [...new Set(
    tasks.filter(t => t.fixVersion).map(t => t.fixVersion!)
  )].sort();
}

// Q2 2026 as fixed reference for all pattern tests
const YEAR = 2026;
const QUARTER = 2;

describe('quarter pattern matching', () => {
  test('"26.2" matches Q2 2026', () => {
    expect(findCurrentQuarterKey(['26.2'], YEAR, QUARTER)).toBe('26.2');
  });

  test('"Q2 2026" matches Q2 2026', () => {
    expect(findCurrentQuarterKey(['Q2 2026'], YEAR, QUARTER)).toBe('Q2 2026');
  });

  test('"R26.2" matches Q2 2026', () => {
    expect(findCurrentQuarterKey(['R26.2'], YEAR, QUARTER)).toBe('R26.2');
  });

  test('"26.3" does NOT match Q2 2026', () => {
    expect(findCurrentQuarterKey(['26.3'], YEAR, QUARTER)).toBe('all');
  });
});

describe('task filtering by effectiveFixVersion', () => {
  test('non-Jira tasks always pass through when effectiveFixVersion is set', () => {
    const tasks = [
      makeTask({ id: 'g-1', source: 'github', fixVersion: undefined }),
      makeTask({ id: 'gm-1', source: 'gmail', fixVersion: undefined }),
    ];
    const result = filterTasksByFixVersion(tasks, '26.2');
    expect(result).toHaveLength(2);
  });

  test('Jira task with matching fixVersion passes through', () => {
    const tasks = [makeTask({ id: 'j-1', source: 'jira', fixVersion: '26.2' })];
    const result = filterTasksByFixVersion(tasks, '26.2');
    expect(result).toHaveLength(1);
  });

  test('Jira task with non-matching fixVersion is excluded', () => {
    const tasks = [makeTask({ id: 'j-1', source: 'jira', fixVersion: '26.3' })];
    const result = filterTasksByFixVersion(tasks, '26.2');
    expect(result).toHaveLength(0);
  });
});

describe('allFixVersions deduplication', () => {
  test('duplicate fixVersions from tasks produce a unique list', () => {
    const tasks = [
      makeTask({ id: 'j-1', source: 'jira', fixVersion: '26.2' }),
      makeTask({ id: 'j-2', source: 'jira', fixVersion: '26.2' }),
      makeTask({ id: 'j-3', source: 'jira', fixVersion: '26.3' }),
    ];
    const versions = buildAllFixVersions(tasks);
    expect(versions).toEqual(['26.2', '26.3']);
  });
});
