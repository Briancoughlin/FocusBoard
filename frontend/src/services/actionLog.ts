/**
 * @file actionLog.ts
 * Lightweight in-memory circular buffer for user action trail.
 *
 * Stores the last 50 actions with timestamps. No persistence — cleared on refresh.
 * Action descriptions are generic — no task titles, ticket keys, or personal data.
 */

interface ActionEntry {
  ts: string;      // HH:MM:SS
  action: string;  // human readable description
}

// Circular buffer — max 50 entries
const MAX_ENTRIES = 50;
const log: ActionEntry[] = [];

export function logAction(action: string): void {
  const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  log.push({ ts, action });
  if (log.length > MAX_ENTRIES) log.shift();
}

export function getActionLog(): ActionEntry[] {
  return [...log];
}

export function formatActionLog(): string {
  return log.map(e => `[${e.ts}] ${e.action}`).join('\n') || 'No actions recorded';
}

export function clearActionLog(): void {
  log.splice(0, log.length);
}
