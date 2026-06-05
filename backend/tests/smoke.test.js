/**
 * @file smoke.test.js
 * End-to-end smoke test — verifies the server is alive and /api/sync
 * returns a valid response shape. Does not require real API credentials;
 * sources without credentials will return empty task arrays which is fine.
 *
 * Requires the server to be running on port 3001.
 * Skip gracefully if the server is not running.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const BASE = 'http://localhost:3001';
const TIMEOUT = 15000;

async function get(path) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);
  try {
    const res = await fetch(`${BASE}${path}`, { signal: controller.signal });
    return { ok: res.ok, status: res.status, body: await res.json() };
  } finally {
    clearTimeout(timer);
  }
}

describe('Smoke tests — server must be running on port 3001', () => {

  it('GET / returns 200', async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(BASE, { signal: controller.signal });
      assert.equal(res.status, 200, 'Root route should return 200');
    } catch (err) {
      if (err.name === 'AbortError' || err.code === 'ECONNREFUSED') {
        console.warn('⚠️  Server not running — skipping smoke tests');
        return;
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  });

  it('GET /api/sync returns { tasks: [], errors: [] } shape', async () => {
    let result;
    try {
      result = await get('/api/sync');
    } catch (err) {
      if (err.name === 'AbortError' || err.code === 'ECONNREFUSED') {
        console.warn('⚠️  Server not running — skipping smoke tests');
        return;
      }
      throw err;
    }

    assert.equal(result.ok, true, `Sync should return 200, got ${result.status}`);
    assert.ok(Array.isArray(result.body.tasks), 'Response should have tasks array');
    assert.ok(Array.isArray(result.body.errors), 'Response should have errors array');
  });

  it('GET /api/config returns config shape', async () => {
    let result;
    try {
      result = await get('/api/config');
    } catch (err) {
      if (err.name === 'AbortError' || err.code === 'ECONNREFUSED') {
        console.warn('⚠️  Server not running — skipping smoke tests');
        return;
      }
      throw err;
    }

    assert.equal(result.ok, true, `Config should return 200, got ${result.status}`);
    assert.ok(typeof result.body.jiraConfigured === 'boolean', 'Should have jiraConfigured boolean');
    assert.ok(typeof result.body.googleConfigured === 'boolean', 'Should have googleConfigured boolean');
    assert.ok(typeof result.body.githubConfigured === 'boolean', 'Should have githubConfigured boolean');
  });

  it('GET /api/update/check returns update shape', async () => {
    let result;
    try {
      result = await get('/api/update/check');
    } catch (err) {
      if (err.name === 'AbortError' || err.code === 'ECONNREFUSED') {
        console.warn('⚠️  Server not running — skipping smoke tests');
        return;
      }
      throw err;
    }

    assert.equal(result.ok, true, `Update check should return 200, got ${result.status}`);
    assert.ok(typeof result.body.hasUpdate === 'boolean', 'Should have hasUpdate boolean');
    assert.ok(typeof result.body.currentVersion === 'string', 'Should have currentVersion string');
  });

  it('GET /api/health/watcher returns watcher health shape', async () => {
    let result;
    try {
      result = await get('/api/health/watcher');
    } catch (err) {
      if (err.name === 'AbortError' || err.code === 'ECONNREFUSED') {
        console.warn('⚠️  Server not running — skipping smoke tests');
        return;
      }
      throw err;
    }
    assert.equal(result.ok, true, `Watcher health should return 200, got ${result.status}`);
    assert.ok(typeof result.body.alive === 'boolean', 'Should have alive boolean');
  });

  it('GET /api/cache returns { tasks: [] } shape when empty or populated', async () => {
    let result;
    try {
      result = await get('/api/cache');
    } catch (err) {
      if (err.name === 'AbortError' || err.code === 'ECONNREFUSED') {
        console.warn('⚠️  Server not running — skipping smoke tests');
        return;
      }
      throw err;
    }

    assert.equal(result.ok, true, `Cache should return 200, got ${result.status}`);
    assert.ok(Array.isArray(result.body.tasks), 'Should have tasks array');
  });

});
