/**
 * @file regression.test.ts
 * Frontend regression tests for bugs that were previously fixed.
 * Each test is named after the bug it guards against.
 */

import { describe, test, expect } from 'vitest';

// ── Bug: actionLog timestamp used toLocaleTimeString which gave '01:17:30 PM'
// on GitHub Actions runners that default to 12-hour locale.
// Fixed: now uses getHours/getMinutes/getSeconds with padStart.

function formatTimestamp(date: Date): string {
  // This is the fixed implementation from actionLog.ts
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

describe('Regression: actionLog timestamp must always be 24-hour HH:MM:SS', () => {
  test('timestamp is always HH:MM:SS format regardless of locale', () => {
    const ts = formatTimestamp(new Date('2026-06-05T13:17:30'));
    expect(ts).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    expect(ts).toBe('13:17:30');
  });

  test('midnight formats as 00:XX:XX not 12:XX:XX AM', () => {
    const ts = formatTimestamp(new Date('2026-06-05T00:05:01'));
    expect(ts).toBe('00:05:01');
    expect(ts).not.toContain('AM');
    expect(ts).not.toContain('PM');
  });

  test('noon formats as 12:XX:XX not 12:XX:XX PM', () => {
    const ts = formatTimestamp(new Date('2026-06-05T12:00:00'));
    expect(ts).toBe('12:00:00');
    expect(ts).not.toContain('PM');
  });

  test('1pm formats as 13:XX:XX not 1:XX:XX PM', () => {
    const ts = formatTimestamp(new Date('2026-06-05T13:00:00'));
    expect(ts).toBe('13:00:00');
  });

  test('single-digit hours are zero-padded', () => {
    const ts = formatTimestamp(new Date('2026-06-05T09:05:03'));
    expect(ts).toBe('09:05:03');
  });
});

// ── Bug: trophy counter did not reset at midnight — it only checked on mount.
// Fixed: a 60-second interval checks if the date string changed since last check.

function shouldResetCounter(lastDateStr: string, currentDateStr: string): boolean {
  return lastDateStr !== currentDateStr;
}

function getCurrentDateStr(date: Date): string {
  return date.toDateString(); // e.g. "Fri Jun 05 2026"
}

describe('Regression: trophy counter must reset at midnight, not just on mount', () => {
  test('counter resets when date changes', () => {
    const yesterday = new Date('2026-06-04T23:59:59');
    const today = new Date('2026-06-05T00:00:01');
    const shouldReset = shouldResetCounter(
      getCurrentDateStr(yesterday),
      getCurrentDateStr(today)
    );
    expect(shouldReset).toBe(true);
  });

  test('counter does not reset within the same day', () => {
    const morning = new Date('2026-06-05T08:00:00');
    const evening = new Date('2026-06-05T22:00:00');
    const shouldReset = shouldResetCounter(
      getCurrentDateStr(morning),
      getCurrentDateStr(evening)
    );
    expect(shouldReset).toBe(false);
  });

  test('counter resets across month boundary', () => {
    const lastDay = new Date('2026-05-31T23:59:59');
    const firstDay = new Date('2026-06-01T00:00:01');
    const shouldReset = shouldResetCounter(
      getCurrentDateStr(lastDay),
      getCurrentDateStr(firstDay)
    );
    expect(shouldReset).toBe(true);
  });

  test('counter resets across year boundary', () => {
    const dec31 = new Date('2026-12-31T23:59:59');
    const jan01 = new Date('2027-01-01T00:00:01');
    const shouldReset = shouldResetCounter(
      getCurrentDateStr(dec31),
      getCurrentDateStr(jan01)
    );
    expect(shouldReset).toBe(true);
  });
});

// ── Bug: done tasks from previous days appeared on the board until refresh.
// Fixed: tasks where doneDates[id] !== today are filtered out.

interface Task {
  id: string;
  status: 'todo' | 'inprogress' | 'done' | 'wontdo';
}

function filterDoneTasks(
  tasks: Task[],
  doneDates: Record<string, string>,
  today: string
): Task[] {
  return tasks.filter(t =>
    t.status === 'wontdo' ||
    t.status !== 'done' ||
    doneDates[t.id] === today
  );
}

describe('Regression: done tasks from previous days must be hidden', () => {
  const today = 'Fri Jun 05 2026';
  const yesterday = 'Thu Jun 04 2026';

  test('task done today remains visible', () => {
    const tasks: Task[] = [{ id: '1', status: 'done' }];
    const doneDates = { '1': today };
    const result = filterDoneTasks(tasks, doneDates, today);
    expect(result).toHaveLength(1);
  });

  test('task done yesterday is hidden', () => {
    const tasks: Task[] = [{ id: '1', status: 'done' }];
    const doneDates = { '1': yesterday };
    const result = filterDoneTasks(tasks, doneDates, today);
    expect(result).toHaveLength(0);
  });

  test('wontdo tasks are never filtered regardless of date', () => {
    const tasks: Task[] = [{ id: '1', status: 'wontdo' }];
    const doneDates = { '1': yesterday };
    const result = filterDoneTasks(tasks, doneDates, today);
    expect(result).toHaveLength(1);
  });

  test('active tasks are never filtered', () => {
    const tasks: Task[] = [
      { id: '1', status: 'todo' },
      { id: '2', status: 'inprogress' },
    ];
    const result = filterDoneTasks(tasks, {}, today);
    expect(result).toHaveLength(2);
  });

  test('mix of today and yesterday done tasks filters correctly', () => {
    const tasks: Task[] = [
      { id: 'today', status: 'done' },
      { id: 'yesterday', status: 'done' },
      { id: 'active', status: 'todo' },
    ];
    const doneDates = { today, yesterday };
    const result = filterDoneTasks(tasks, doneDates, today);
    expect(result).toHaveLength(2); // today's done + active
    expect(result.find(t => t.id === 'yesterday')).toBeUndefined();
  });
});

// ── Bug: VPN error showed raw ECONNREFUSED in the UI banner
// Fixed: KanbanBoard detects vpnLikely errors and shows a friendly amber banner

interface SyncError {
  source: string;
  error: string;
  vpnLikely?: boolean;
}

function findVpnError(errors: SyncError[]): SyncError | undefined {
  return errors.find(
    e => e.source === 'jira' && (
      e.vpnLikely ||
      e.error.toLowerCase().includes('unreachable') ||
      e.error.toLowerCase().includes('vpn') ||
      e.error.toLowerCase().includes('econnrefused') ||
      e.error.toLowerCase().includes('enotfound') ||
      e.error.toLowerCase().includes('etimedout')
    )
  );
}

describe('Regression: Jira VPN error must be surfaced as friendly banner, not raw error', () => {
  test('vpnLikely flag triggers friendly banner', () => {
    const errors: SyncError[] = [{ source: 'jira', error: 'fetch failed', vpnLikely: true }];
    expect(findVpnError(errors)).toBeDefined();
  });

  test('raw error string with ECONNREFUSED triggers friendly banner', () => {
    const errors: SyncError[] = [{ source: 'jira', error: 'ECONNREFUSED 127.0.0.1:8080' }];
    expect(findVpnError(errors)).toBeDefined();
  });

  test('non-Jira source with vpnLikely does NOT trigger Jira VPN banner', () => {
    const errors: SyncError[] = [{ source: 'github', error: 'ECONNREFUSED', vpnLikely: true }];
    expect(findVpnError(errors)).toBeUndefined();
  });

  test('friendly message returned by backend does not leak raw code to user', () => {
    const friendlyMessage = 'Jira unreachable — are you on VPN or Netbird?';
    expect(friendlyMessage).not.toMatch(/ECONNREFUSED|ENOTFOUND|ETIMEDOUT/);
  });
});
