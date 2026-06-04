/**
 * Tests for encrypt/decrypt round-trip using backend/crypto-utils.js
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { encryptConfig, decryptConfig } from '../crypto-utils.js';

test('encrypt then decrypt returns original object', () => {
  const original = { jiraUrl: 'https://jira.example.com', jiraToken: 'secret123' };
  const encrypted = encryptConfig(original);
  const decrypted = decryptConfig(encrypted);
  assert.deepEqual(decrypted, original);
});

test('encrypted output has required fields', () => {
  const original = { key: 'value' };
  const result = encryptConfig(original);
  assert.equal(result.encrypted, true);
  assert.ok(typeof result.iv === 'string', 'iv should be a string');
  assert.ok(typeof result.authTag === 'string', 'authTag should be a string');
  assert.ok(typeof result.data === 'string', 'data should be a string');
});

test('decrypting with corrupted data throws', () => {
  const original = { secret: 'value' };
  const encrypted = encryptConfig(original);
  // Corrupt the data field
  const corrupted = { ...encrypted, data: 'deadbeef'.repeat(10) };
  assert.throws(() => decryptConfig(corrupted));
});

test('config with special characters survives round-trip', () => {
  const original = {
    jiraToken: 'tok€n-with-special_chars!@#$%^&*()',
    jiraUrl: 'https://jira.example.com/path?query=value&other=1',
  };
  const decrypted = decryptConfig(encryptConfig(original));
  assert.deepEqual(decrypted, original);
});

test('empty config survives round-trip', () => {
  const original = {};
  const decrypted = decryptConfig(encryptConfig(original));
  assert.deepEqual(decrypted, original);
});
