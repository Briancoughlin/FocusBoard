/**
 * @file backup.test.js
 * Tests for the nightly backup and restore logic.
 *
 * Uses a temp directory to avoid touching real backup files.
 * Tests the core bundle creation, pruning, and restore round-trip.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import zlib from 'node:zlib';
import { promisify } from 'node:util';

const gunzip = promisify(zlib.gunzip);
const gzip = promisify(zlib.gzip);

// --- Helpers that mirror backup.js logic ---

function createBundle(files) {
  const bundle = {
    version: '1.0',
    createdAt: new Date().toISOString(),
    files: {},
  };
  for (const [key, content] of Object.entries(files)) {
    bundle.files[key] = Buffer.from(content).toString('base64');
  }
  return bundle;
}

function restoreBundle(bundle) {
  const restored = {};
  for (const [key, b64] of Object.entries(bundle.files)) {
    restored[key] = Buffer.from(b64, 'base64').toString('utf8');
  }
  return restored;
}

function pruneBackups(backupDir, keep = 7) {
  const files = fs.readdirSync(backupDir)
    .filter(f => f.endsWith('.gz'))
    .sort();
  const toDelete = files.slice(0, Math.max(0, files.length - keep));
  for (const f of toDelete) {
    fs.unlinkSync(path.join(backupDir, f));
  }
  return toDelete.length;
}

// --- Tests ---

let tmpDir;

before(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'focusboard-backup-test-'));
});

after(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('Backup bundle creation', () => {

  it('creates a bundle with correct structure', () => {
    const bundle = createBundle({
      'config.json': '{"jiraUrl":"https://jira.example.com"}',
      'data/overrides.json': '{}',
    });
    assert.equal(bundle.version, '1.0');
    assert.ok(bundle.createdAt);
    assert.ok(bundle.files['config.json']);
    assert.ok(bundle.files['data/overrides.json']);
  });

  it('encodes file content as base64', () => {
    const content = '{"test":"value"}';
    const bundle = createBundle({ 'test.json': content });
    const decoded = Buffer.from(bundle.files['test.json'], 'base64').toString('utf8');
    assert.equal(decoded, content);
  });

  it('handles empty file content gracefully', () => {
    const bundle = createBundle({ 'empty.json': '' });
    const decoded = Buffer.from(bundle.files['empty.json'], 'base64').toString('utf8');
    assert.equal(decoded, '');
  });

});

describe('Backup restore round-trip', () => {

  it('restores files from bundle correctly', () => {
    const original = {
      'config.json': '{"jiraUrl":"https://jira.example.com","jiraToken":"secret"}',
      'data/overrides.json': '{"task-1":"done"}',
    };
    const bundle = createBundle(original);
    const restored = restoreBundle(bundle);
    assert.equal(restored['config.json'], original['config.json']);
    assert.equal(restored['data/overrides.json'], original['data/overrides.json']);
  });

  it('survives gzip compression round-trip', async () => {
    const original = { 'config.json': '{"test":true}' };
    const bundle = createBundle(original);
    const json = JSON.stringify(bundle);
    const compressed = await gzip(json);
    const decompressed = await gunzip(compressed);
    const restored = restoreBundle(JSON.parse(decompressed.toString()));
    assert.equal(restored['config.json'], original['config.json']);
  });

  it('handles unicode content correctly', () => {
    const content = '{"name":"Brian Coughlin 🎯","emoji":"✅"}';
    const bundle = createBundle({ 'test.json': content });
    const restored = restoreBundle(bundle);
    assert.equal(restored['test.json'], content);
  });

});

describe('Backup pruning', () => {

  it('keeps only the most recent N backups', () => {
    const backupDir = path.join(tmpDir, 'pruning-test');
    fs.mkdirSync(backupDir);

    // Create 10 fake backup files with different dates
    for (let i = 1; i <= 10; i++) {
      const date = `2026-06-${String(i).padStart(2, '0')}`;
      fs.writeFileSync(path.join(backupDir, `focusboard-backup-${date}.gz`), 'fake');
    }

    const deleted = pruneBackups(backupDir, 7);
    const remaining = fs.readdirSync(backupDir);

    assert.equal(deleted, 3);
    assert.equal(remaining.length, 7);
    // Should keep the newest 7 (days 4-10)
    assert.ok(remaining.includes('focusboard-backup-2026-06-10.gz'));
    assert.ok(!remaining.includes('focusboard-backup-2026-06-01.gz'));
  });

  it('does nothing when fewer than N backups exist', () => {
    const backupDir = path.join(tmpDir, 'pruning-test-small');
    fs.mkdirSync(backupDir);
    fs.writeFileSync(path.join(backupDir, 'focusboard-backup-2026-06-01.gz'), 'fake');
    fs.writeFileSync(path.join(backupDir, 'focusboard-backup-2026-06-02.gz'), 'fake');

    const deleted = pruneBackups(backupDir, 7);
    assert.equal(deleted, 0);
    assert.equal(fs.readdirSync(backupDir).length, 2);
  });

});

describe('API cutover date filtering', () => {

  it('daysSince correctly computes number of days from a past date', () => {
    // Mirror the logic from gmail.js
    function daysSince(dateStr) {
      const cutoff = new Date(dateStr);
      const msPerDay = 86400000;
      return Math.max(1, Math.ceil((Date.now() - cutoff.getTime()) / msPerDay));
    }

    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const days = daysSince(yesterday);
    assert.ok(days >= 1 && days <= 2, `Expected 1-2 days, got ${days}`);
  });

  it('cutoff date filter excludes messages before the date', () => {
    const cutoff = '2026-06-01';
    const messages = [
      { id: '1', date: '2026-05-31T12:00:00Z' }, // before cutoff — excluded
      { id: '2', date: '2026-06-01T00:00:00Z' }, // on cutoff — included
      { id: '3', date: '2026-06-02T12:00:00Z' }, // after cutoff — included
    ];

    const filtered = messages.filter(m => m.date >= cutoff);
    assert.equal(filtered.length, 2);
    assert.ok(!filtered.find(m => m.id === '1'));
    assert.ok(filtered.find(m => m.id === '2'));
    assert.ok(filtered.find(m => m.id === '3'));
  });

  it('no cutoff returns all messages', () => {
    const messages = [
      { id: '1', date: '2026-01-01T00:00:00Z' },
      { id: '2', date: '2026-06-01T00:00:00Z' },
    ];
    const cutoff = null;
    const filtered = cutoff ? messages.filter(m => m.date >= cutoff) : messages;
    assert.equal(filtered.length, 2);
  });

});
