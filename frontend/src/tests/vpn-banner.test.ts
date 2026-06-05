/**
 * Tests for VPN error detection logic from KanbanBoard.tsx.
 * The detection is extracted here as a pure function for testability.
 */

import { describe, test, expect } from 'vitest';

interface ErrorEntry {
  source: string;
  error: string;
  vpnLikely?: boolean;
}

// Copied from KanbanBoard.tsx
function findVpnError(errors: ErrorEntry[]): ErrorEntry | undefined {
  return errors.find(
    e => e.source === 'jira' && (
      (e as { vpnLikely?: boolean }).vpnLikely ||
      e.error.toLowerCase().includes('unreachable') ||
      e.error.toLowerCase().includes('vpn') ||
      e.error.toLowerCase().includes('econnrefused') ||
      e.error.toLowerCase().includes('enotfound') ||
      e.error.toLowerCase().includes('etimedout')
    )
  );
}

describe('findVpnError', () => {
  test('vpnLikely flag on jira error is detected', () => {
    const errors: ErrorEntry[] = [{ source: 'jira', error: 'connection failed', vpnLikely: true }];
    expect(findVpnError(errors)).toBeDefined();
  });

  test('jira error containing "unreachable" is detected', () => {
    const errors: ErrorEntry[] = [{ source: 'jira', error: 'Host is unreachable' }];
    expect(findVpnError(errors)).toBeDefined();
  });

  test('jira error containing "vpn" is detected case-insensitively', () => {
    const errors: ErrorEntry[] = [{ source: 'jira', error: 'Please connect to VPN first' }];
    expect(findVpnError(errors)).toBeDefined();
  });

  test('jira error containing "ECONNREFUSED" is detected', () => {
    const errors: ErrorEntry[] = [{ source: 'jira', error: 'ECONNREFUSED 10.0.0.1:8080' }];
    expect(findVpnError(errors)).toBeDefined();
  });

  test('non-jira source with vpnLikely true is NOT detected', () => {
    const errors: ErrorEntry[] = [{ source: 'github', error: 'connection failed', vpnLikely: true }];
    expect(findVpnError(errors)).toBeUndefined();
  });

  test('normal jira 500 error is NOT detected', () => {
    const errors: ErrorEntry[] = [{ source: 'jira', error: 'Internal Server Error (500)' }];
    expect(findVpnError(errors)).toBeUndefined();
  });

  test('"Jira not configured" error is NOT detected', () => {
    const errors: ErrorEntry[] = [{ source: 'jira', error: 'Jira not configured' }];
    expect(findVpnError(errors)).toBeUndefined();
  });

  test('multiple errors — only jira one with vpnLikely is returned', () => {
    const jiraError: ErrorEntry = { source: 'jira', error: 'timeout', vpnLikely: true };
    const errors: ErrorEntry[] = [
      { source: 'github', error: 'some github error', vpnLikely: true },
      { source: 'gmail', error: 'auth failed' },
      jiraError,
    ];
    expect(findVpnError(errors)).toBe(jiraError);
  });
});
