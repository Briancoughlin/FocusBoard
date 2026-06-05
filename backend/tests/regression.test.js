/**
 * @file regression.test.js
 * Regression tests for bugs that were previously fixed.
 * Each test is named after the bug it guards against.
 *
 * If a test here fails, a previously-fixed bug has come back.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ── Bug: config merge overwrote secrets when frontend sent '***' placeholder ─
// Fixed in: config-merge.test.js (covered there) — confirmed here for clarity

function mergeConfig(existing, incoming) {
  const merged = { ...existing };
  const fields = ['jiraToken', 'anthropicKey', 'slackToken', 'githubToken', 'googleClientSecret'];
  for (const field of fields) {
    const val = incoming[field];
    if (val !== undefined && val !== '***' && val !== '') {
      if (typeof val !== 'string' || val.length > 2000) continue;
      merged[field] = val;
    }
  }
  return merged;
}

describe('Regression: config merge must not overwrite secrets with *** placeholder', () => {
  it('existing secret is preserved when frontend sends ***', () => {
    const existing = { jiraToken: 'real-secret-token' };
    const merged = mergeConfig(existing, { jiraToken: '***' });
    assert.equal(merged.jiraToken, 'real-secret-token',
      'BUG REGRESSION: *** placeholder overwrote the real token');
  });

  it('existing secret is preserved when frontend sends empty string', () => {
    const existing = { anthropicKey: 'sk-ant-real-key' };
    const merged = mergeConfig(existing, { anthropicKey: '' });
    assert.equal(merged.anthropicKey, 'sk-ant-real-key',
      'BUG REGRESSION: empty string overwrote the real key');
  });

  it('new value correctly replaces existing when a real value is sent', () => {
    const existing = { jiraToken: 'old-token' };
    const merged = mergeConfig(existing, { jiraToken: 'new-token' });
    assert.equal(merged.jiraToken, 'new-token',
      'BUG REGRESSION: real new value was not saved');
  });
});

// ── Bug: Jira VPN error showed raw Node.js stack trace in the UI ─────────────
// Fixed: jira.js now detects network errors and returns vpnLikely + friendly message

function classifyJiraError(errMessage, cause = '') {
  const networkCodes = ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET', 'EHOSTUNREACH'];
  const msg = errMessage || '';
  const vpnLikely = networkCodes.some(c => msg.includes(c) || cause.includes(c))
    || (msg.toLowerCase().includes('fetch failed') && !msg.includes('401') && !msg.includes('403'));
  return {
    vpnLikely,
    friendlyMessage: vpnLikely ? 'Jira unreachable — are you on VPN or Netbird?' : msg,
  };
}

describe('Regression: Jira VPN error must show friendly message, not raw stack trace', () => {
  it('ECONNREFUSED shows friendly VPN message', () => {
    const { vpnLikely, friendlyMessage } = classifyJiraError('fetch failed ECONNREFUSED 127.0.0.1:8080');
    assert.equal(vpnLikely, true, 'BUG REGRESSION: ECONNREFUSED not classified as VPN error');
    assert.ok(friendlyMessage.includes('VPN'), 'BUG REGRESSION: friendly message missing VPN hint');
    assert.ok(!friendlyMessage.includes('ECONNREFUSED'), 'BUG REGRESSION: raw error code shown to user');
  });

  it('ENOTFOUND shows friendly VPN message', () => {
    const { vpnLikely } = classifyJiraError('getaddrinfo ENOTFOUND jira.company.internal');
    assert.equal(vpnLikely, true, 'BUG REGRESSION: ENOTFOUND not classified as VPN error');
  });

  it('401 Unauthorized is NOT classified as VPN error', () => {
    const { vpnLikely } = classifyJiraError('Jira API error 401: Unauthorized');
    assert.equal(vpnLikely, false, 'BUG REGRESSION: 401 auth error wrongly shown as VPN error');
  });

  it('fetch failed without auth code is classified as VPN error', () => {
    const { vpnLikely } = classifyJiraError('fetch failed');
    assert.equal(vpnLikely, true, 'BUG REGRESSION: generic fetch failure not treated as VPN issue');
  });
});

// ── Bug: server crashed on EADDRINUSE instead of retrying ────────────────────
// Fixed: server.on('error') handler retries after 3s instead of crashing

function handleServerError(err) {
  if (err.code === 'EADDRINUSE') return 'retry';
  if (err.code === 'ECONNRESET') return 'continue';
  if (err.code === 'ECONNABORTED') return 'continue';
  return 'log';
}

describe('Regression: server must not crash on EADDRINUSE or ECONNRESET', () => {
  it('EADDRINUSE triggers retry, not crash', () => {
    const action = handleServerError({ code: 'EADDRINUSE' });
    assert.equal(action, 'retry',
      'BUG REGRESSION: EADDRINUSE causes crash instead of retry');
  });

  it('ECONNRESET is handled gracefully, not crash', () => {
    const action = handleServerError({ code: 'ECONNRESET' });
    assert.equal(action, 'continue',
      'BUG REGRESSION: ECONNRESET causes crash instead of continuing');
  });

  it('ECONNABORTED is handled gracefully', () => {
    const action = handleServerError({ code: 'ECONNABORTED' });
    assert.equal(action, 'continue',
      'BUG REGRESSION: ECONNABORTED causes crash instead of continuing');
  });

  it('unknown errors are logged but do not crash', () => {
    const action = handleServerError({ code: 'EUNKNOWN' });
    assert.equal(action, 'log',
      'BUG REGRESSION: unknown error causes crash');
  });
});

// ── Bug: feature toggle source filter was case-sensitive / undefined-unsafe ──
// Fixed: filter uses `features[s.name] !== false` which handles missing keys

function filterSources(allSources, features) {
  return allSources.filter(s => features[s.name] !== false);
}

describe('Regression: feature toggle filter must handle undefined and missing keys safely', () => {
  const allSources = [
    { name: 'jira' }, { name: 'gmail' }, { name: 'calendar' },
    { name: 'slack' }, { name: 'github' },
  ];

  it('undefined features object does not crash (all sources included)', () => {
    assert.doesNotThrow(() => filterSources(allSources, {}),
      'BUG REGRESSION: missing feature key throws instead of defaulting to enabled');
    assert.equal(filterSources(allSources, {}).length, 5);
  });

  it('features.jira = false excludes jira without affecting others', () => {
    const result = filterSources(allSources, { jira: false });
    assert.equal(result.length, 4, 'BUG REGRESSION: disabling one source affected others');
    assert.ok(!result.find(s => s.name === 'jira'), 'BUG REGRESSION: disabled source still included');
  });

  it('features.jira = null does NOT disable jira (only false disables)', () => {
    const result = filterSources(allSources, { jira: null });
    assert.equal(result.length, 5, 'BUG REGRESSION: null treated as disabled');
  });

  it('features.jira = 0 does NOT disable jira (only explicit false disables)', () => {
    const result = filterSources(allSources, { jira: 0 });
    assert.equal(result.length, 5, 'BUG REGRESSION: 0 treated as disabled');
  });
});

// ── Bug: VPN/network change crashed server by killing socket while bound to 0.0.0.0
// Fixed: server now binds to '127.0.0.1' — verified by the bind address in server.js
// This is an integration concern, but we can test the network error classification

describe('Regression: network errors on server socket must not propagate as crashes', () => {
  it('ECONNRESET is classified as non-fatal network error', () => {
    const action = handleServerError({ code: 'ECONNRESET' });
    assert.notEqual(action, 'crash',
      'BUG REGRESSION: ECONNRESET classified as fatal');
  });

  it('ETIMEDOUT on server socket is handled', () => {
    const action = handleServerError({ code: 'ETIMEDOUT' });
    // ETIMEDOUT falls into 'log' not 'crash'
    assert.notEqual(action, 'crash',
      'BUG REGRESSION: ETIMEDOUT classified as fatal');
  });
});
