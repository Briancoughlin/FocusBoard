/**
 * @file actionLog.test.ts
 * Tests for the action log circular buffer (actionLog.ts).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { logAction, getActionLog, formatActionLog, clearActionLog } from '../services/actionLog';

beforeEach(() => {
  clearActionLog();
});

describe('logAction', () => {
  it('adds an entry with the correct action string', () => {
    logAction('opened task board');
    const log = getActionLog();
    expect(log).toHaveLength(1);
    expect(log[0].action).toBe('opened task board');
  });

  it('entries have timestamps matching HH:MM:SS format', () => {
    logAction('test action');
    const log = getActionLog();
    expect(log[0].ts).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });
});

describe('circular buffer', () => {
  it('caps at 50 entries when 60 are added', () => {
    for (let i = 1; i <= 60; i++) {
      logAction(`action ${i}`);
    }
    const log = getActionLog();
    expect(log).toHaveLength(50);
  });

  it('keeps the last 50 entries (drops the oldest)', () => {
    for (let i = 1; i <= 60; i++) {
      logAction(`action ${i}`);
    }
    const log = getActionLog();
    expect(log[0].action).toBe('action 11');
    expect(log[49].action).toBe('action 60');
  });
});

describe('formatActionLog', () => {
  it('returns correct [HH:MM:SS] action text format per line', () => {
    logAction('did something');
    const formatted = formatActionLog();
    expect(formatted).toMatch(/^\[\d{2}:\d{2}:\d{2}\] did something$/);
  });

  it('returns "No actions recorded" when the log is empty', () => {
    expect(formatActionLog()).toBe('No actions recorded');
  });

  it('formats multiple entries one per line', () => {
    logAction('first action');
    logAction('second action');
    const lines = formatActionLog().split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/^\[\d{2}:\d{2}:\d{2}\] first action$/);
    expect(lines[1]).toMatch(/^\[\d{2}:\d{2}:\d{2}\] second action$/);
  });
});

describe('clearActionLog', () => {
  it('empties the buffer so getActionLog returns []', () => {
    logAction('some action');
    clearActionLog();
    expect(getActionLog()).toHaveLength(0);
  });
});
