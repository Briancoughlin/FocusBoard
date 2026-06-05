/**
 * @file docker-mode.test.js
 * Tests for Docker-specific behaviour:
 *   - FOCUSBOARD_KEY validation when FOCUSBOARD_DOCKER=true
 *   - Key derivation uses env var when set, falls back to machine binding otherwise
 *   - Auth bypass is only active when the env var is explicitly set
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import os from 'node:os';

// ── Key derivation logic (mirrors crypto-utils.js) ────────────────────────────
function deriveKey(envKey) {
  const raw = envKey
    ? envKey + 'focusboard-v1'
    : os.hostname() + os.userInfo().username + 'focusboard-v1';
  return crypto.createHash('sha256').update(raw).digest();
}

describe('Docker mode — key derivation', () => {

  it('uses FOCUSBOARD_KEY env var when set', () => {
    const key = deriveKey('my-stable-docker-key');
    assert.ok(Buffer.isBuffer(key), 'Key should be a Buffer');
    assert.equal(key.length, 32, 'AES-256 key should be 32 bytes');
  });

  it('same FOCUSBOARD_KEY always produces same key', () => {
    const k1 = deriveKey('stable-key-abc');
    const k2 = deriveKey('stable-key-abc');
    assert.deepEqual(k1, k2, 'Same input should always produce same key');
  });

  it('different FOCUSBOARD_KEY produces different key', () => {
    const k1 = deriveKey('key-one');
    const k2 = deriveKey('key-two');
    assert.notDeepEqual(k1, k2, 'Different keys should produce different output');
  });

  it('falls back to machine binding when env var not set', () => {
    const key = deriveKey(undefined);
    assert.ok(Buffer.isBuffer(key), 'Fallback key should be a Buffer');
    assert.equal(key.length, 32, 'Fallback key should be 32 bytes');
  });

  it('machine-bound key is different from env-var key', () => {
    const machineKey = deriveKey(undefined);
    const dockerKey  = deriveKey('my-docker-secret');
    assert.notDeepEqual(machineKey, dockerKey, 'Machine key and Docker key should differ');
  });

});

// ── Auth bypass logic (mirrors server.js middleware) ──────────────────────────
function shouldBypassAuth(dockerEnv) {
  return dockerEnv === 'true';
}

describe('Docker mode — auth bypass', () => {

  it('bypasses auth when FOCUSBOARD_DOCKER=true', () => {
    assert.equal(shouldBypassAuth('true'), true);
  });

  it('does not bypass auth when FOCUSBOARD_DOCKER is not set', () => {
    assert.equal(shouldBypassAuth(undefined), false);
  });

  it('does not bypass auth when FOCUSBOARD_DOCKER=false', () => {
    assert.equal(shouldBypassAuth('false'), false);
  });

  it('does not bypass auth for any truthy-but-wrong value', () => {
    assert.equal(shouldBypassAuth('1'),    false);
    assert.equal(shouldBypassAuth('yes'),  false);
    assert.equal(shouldBypassAuth('True'), false); // case-sensitive
  });

});

// ── Startup validation (mirrors the check in server.js) ──────────────────────
function validateDockerStartup(dockerEnv, keyEnv) {
  if (dockerEnv === 'true' && !keyEnv) {
    return { valid: false, reason: 'FOCUSBOARD_KEY must be set when FOCUSBOARD_DOCKER=true' };
  }
  return { valid: true };
}

describe('Docker mode — startup validation', () => {

  it('valid when both FOCUSBOARD_DOCKER and FOCUSBOARD_KEY are set', () => {
    const result = validateDockerStartup('true', 'my-secure-key-abc123');
    assert.equal(result.valid, true);
  });

  it('invalid when FOCUSBOARD_DOCKER=true but FOCUSBOARD_KEY is missing', () => {
    const result = validateDockerStartup('true', undefined);
    assert.equal(result.valid, false);
    assert.ok(result.reason.includes('FOCUSBOARD_KEY'), 'Error should mention FOCUSBOARD_KEY');
  });

  it('invalid when FOCUSBOARD_DOCKER=true and FOCUSBOARD_KEY is empty string', () => {
    const result = validateDockerStartup('true', '');
    assert.equal(result.valid, false);
  });

  it('valid in native mode without FOCUSBOARD_KEY (machine binding used)', () => {
    const result = validateDockerStartup(undefined, undefined);
    assert.equal(result.valid, true);
  });

  it('valid in native mode even if FOCUSBOARD_KEY is provided', () => {
    const result = validateDockerStartup(undefined, 'optional-override-key');
    assert.equal(result.valid, true);
  });

});
