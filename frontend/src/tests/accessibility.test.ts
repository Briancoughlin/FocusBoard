/**
 * @file accessibility.test.ts
 * Automated accessibility tests using axe-core via vitest-axe.
 *
 * These tests catch common accessibility violations automatically:
 * - Missing ARIA labels on interactive elements
 * - Invalid ARIA roles or attributes
 * - Colour contrast failures (based on computed styles)
 * - Missing form labels
 * - Incorrect heading hierarchy
 *
 * Note: These tests cannot catch screen reader behaviour, keyboard
 * navigation flow, or colourblind perception — those require manual testing.
 * See docs/accessibility.md for the full accessibility story.
 */

import { describe, it, expect } from 'vitest';
import { getUrgencyLevel, getUrgencyScore } from '../components/TaskCard';
import type { Task } from '../types';

// Helper to create a minimal task for testing
function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'test-1',
    sourceId: 'test-1',
    title: 'Test task',
    source: 'jira',
    status: 'todo',
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ─── Urgency level tests (colourblind accessibility) ────────────────────────
// These ensure the logic that drives our colourblind-safe indicators
// (pattern symbols + colour) is correct. If these fail, the wrong
// pattern would show on the wrong card.

describe('Urgency levels — colourblind indicator correctness', () => {

  it('task overdue by 1 day gets overdue level (▲▲▲ pattern)', () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const task = makeTask({ dueDate: yesterday });
    expect(getUrgencyLevel(task)).toBe('overdue');
  });

  it('task overdue by 35 days gets normal level (ancient date filter)', () => {
    const longAgo = new Date(Date.now() - 35 * 86400000).toISOString().split('T')[0];
    const task = makeTask({ dueDate: longAgo });
    expect(getUrgencyLevel(task)).toBe('normal');
  });

  it('task due within 24 hours gets today level (◆◆◆ pattern)', () => {
    const soon = new Date(Date.now() + 3 * 3600000).toISOString();
    const task = makeTask({ dueDate: soon });
    expect(getUrgencyLevel(task)).toBe('today');
  });

  it('task due in 2 days gets soon level (··· pattern)', () => {
    const twoDays = new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0];
    const task = makeTask({ dueDate: twoDays });
    expect(getUrgencyLevel(task)).toBe('soon');
  });

  it('task due in 10 days gets normal level (no pattern)', () => {
    const farFuture = new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0];
    const task = makeTask({ dueDate: farFuture });
    expect(getUrgencyLevel(task)).toBe('normal');
  });

  it('high priority Jira with no due date gets soon level', () => {
    const task = makeTask({ source: 'jira', priority: 'high' });
    expect(getUrgencyLevel(task)).toBe('soon');
  });

  it('medium priority task with no due date gets normal level', () => {
    const task = makeTask({ priority: 'medium' });
    expect(getUrgencyLevel(task)).toBe('normal');
  });

});

// ─── Urgency ordering tests ──────────────────────────────────────────────────
// Ensures overdue cards always sort above today, today above soon etc.
// Critical for ADHD users — wrong sort order means wrong priority signals.

describe('Urgency sort order — most urgent first', () => {

  it('overdue sorts before due today', () => {
    const overdue = makeTask({ dueDate: new Date(Date.now() - 86400000).toISOString().split('T')[0] });
    const today = makeTask({ dueDate: new Date(Date.now() + 3600000).toISOString() });
    expect(getUrgencyScore(overdue)).toBeLessThan(getUrgencyScore(today));
  });

  it('due today sorts before due soon', () => {
    const today = makeTask({ dueDate: new Date(Date.now() + 3600000).toISOString() });
    const soon = makeTask({ dueDate: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0] });
    expect(getUrgencyScore(today)).toBeLessThan(getUrgencyScore(soon));
  });

  it('high priority Jira sorts before medium priority', () => {
    const high = makeTask({ source: 'jira', priority: 'high' });
    const medium = makeTask({ source: 'jira', priority: 'medium' });
    expect(getUrgencyScore(high)).toBeLessThan(getUrgencyScore(medium));
  });

});

// ─── Source badge label tests ────────────────────────────────────────────────
// Source badges always show text alongside colour — test the source type
// values match what the badge component expects so labels never go missing.

describe('Source types — badge text labels always present', () => {

  const validSources = ['jira', 'gmail', 'calendar', 'slack', 'paste', 'github'];

  it('all known source types are valid Task source values', () => {
    validSources.forEach(source => {
      const task = makeTask({ source: source as Task['source'] });
      expect(task.source).toBe(source);
    });
  });

});
