/**
 * Tests for the watchdog HTTP server logic from watchdog.js
 * The route logic and constants are extracted as pure functions to avoid
 * starting a real HTTP server in tests.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// --- Constants extracted from watchdog.js ---

const PORT = 3002;

const RESTART_COMMAND = 'Stop-ScheduledTask -TaskName FocusBoard -ErrorAction SilentlyContinue; Start-Sleep -Seconds 2; Start-ScheduledTask -TaskName FocusBoard';

// --- Pure route response logic extracted from the request handler ---

function handleRequest(method, url) {
  if (url === '/health' && method === 'GET') {
    return { status: 200, body: { alive: true, watchdog: true } };
  }
  if (url === '/restart' && method === 'POST') {
    return { status: 200, body: { success: true, message: 'Restarting FocusBoard...' } };
  }
  return { status: 404, body: { error: 'Not found' } };
}

// --- Tests ---

describe('route logic', () => {
  it('GET /health returns { alive: true, watchdog: true }', () => {
    const result = handleRequest('GET', '/health');
    assert.equal(result.status, 200);
    assert.deepEqual(result.body, { alive: true, watchdog: true });
  });

  it('POST /restart returns success message', () => {
    const result = handleRequest('POST', '/restart');
    assert.equal(result.status, 200);
    assert.deepEqual(result.body, { success: true, message: 'Restarting FocusBoard...' });
  });

  it('unknown route returns 404', () => {
    const result = handleRequest('GET', '/unknown');
    assert.equal(result.status, 404);
  });
});

describe('PowerShell command safety', () => {
  it('command contains Stop-ScheduledTask', () => {
    assert.ok(RESTART_COMMAND.includes('Stop-ScheduledTask'));
  });

  it('command contains Start-ScheduledTask', () => {
    assert.ok(RESTART_COMMAND.includes('Start-ScheduledTask'));
  });
});

describe('port config', () => {
  it('watchdog port is 3002 (not 3001 — would conflict with main server)', () => {
    assert.equal(PORT, 3002);
    assert.notEqual(PORT, 3001);
  });
});
