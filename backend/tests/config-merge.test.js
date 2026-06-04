/**
 * Tests for the config field merge logic from server.js
 * The merge logic is copied into a testable function here.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

const ALLOWED_FIELDS = [
  'jiraUrl', 'jiraEmail', 'jiraToken', 'jiraJql', 'defaultJiraProject',
  'googleClientId', 'googleClientSecret',
  'slackToken', 'slackWorkspaceUrl', 'slackTeamId', 'anthropicKey', 'anthropicBaseUrl',
  'githubToken', 'githubBaseUrl',
];

/**
 * Merge logic extracted from the POST /api/config handler in server.js
 */
function mergeConfig(existing, incoming) {
  const merged = { ...existing };

  for (const field of ALLOWED_FIELDS) {
    const val = incoming[field];
    if (val !== undefined && val !== '***' && val !== '') {
      if (typeof val !== 'string' || val.length > 2000) continue;
      merged[field] = val;
    }
  }

  if (
    incoming.slackChannelMap !== undefined &&
    typeof incoming.slackChannelMap === 'object' &&
    incoming.slackChannelMap !== null
  ) {
    merged.slackChannelMap = incoming.slackChannelMap;
  }

  return merged;
}

test('new value saves correctly', () => {
  const existing = { jiraUrl: 'https://old.example.com' };
  const incoming = { jiraUrl: 'https://new.example.com' };
  const result = mergeConfig(existing, incoming);
  assert.equal(result.jiraUrl, 'https://new.example.com');
});

test('*** placeholder is ignored', () => {
  const existing = { jiraToken: 'real-secret-token' };
  const incoming = { jiraToken: '***' };
  const result = mergeConfig(existing, incoming);
  assert.equal(result.jiraToken, 'real-secret-token');
});

test('empty string is ignored', () => {
  const existing = { jiraEmail: 'user@example.com' };
  const incoming = { jiraEmail: '' };
  const result = mergeConfig(existing, incoming);
  assert.equal(result.jiraEmail, 'user@example.com');
});

test('value over 2000 chars is rejected', () => {
  const existing = { jiraUrl: 'https://original.example.com' };
  const incoming = { jiraUrl: 'x'.repeat(2001) };
  const result = mergeConfig(existing, incoming);
  assert.equal(result.jiraUrl, 'https://original.example.com');
});

test('slackChannelMap object saves correctly', () => {
  const existing = {};
  const incoming = { slackChannelMap: { general: 'C12345', dev: 'C67890' } };
  const result = mergeConfig(existing, incoming);
  assert.deepEqual(result.slackChannelMap, { general: 'C12345', dev: 'C67890' });
});
