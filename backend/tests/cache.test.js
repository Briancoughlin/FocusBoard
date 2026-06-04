/**
 * @file cache.test.js
 * Tests for the task cache read/write logic.
 * Uses a temp file so tests don't affect real data.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Helper functions that mirror the cache route logic
function readCache(filePath) {
  if (!fs.existsSync(filePath)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return data.tasks || [];
  } catch { return []; }
}

function writeCache(filePath, tasks) {
  fs.writeFileSync(filePath, JSON.stringify({ tasks, cachedAt: new Date().toISOString() }), 'utf8');
}

describe('Cache read/write logic', () => {
  let tmpFile;

  before(() => {
    tmpFile = path.join(os.tmpdir(), `focusboard-cache-test-${Date.now()}.json`);
  });

  after(() => {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  });

  it('Read when no file exists returns empty array gracefully', () => {
    const nonExistent = path.join(os.tmpdir(), `focusboard-no-such-file-${Date.now()}.json`);
    const result = readCache(nonExistent);
    assert.deepEqual(result, []);
  });

  it('Write then read returns the written tasks correctly', () => {
    const tasks = [
      { id: 'task-1', title: 'First task', status: 'todo', source: 'jira' },
      { id: 'task-2', title: 'Second task', status: 'inprogress', source: 'github' },
    ];
    writeCache(tmpFile, tasks);
    const result = readCache(tmpFile);
    assert.deepEqual(result, tasks);
  });

  it('Read with malformed JSON returns empty array and does not throw', () => {
    const malformedFile = path.join(os.tmpdir(), `focusboard-malformed-${Date.now()}.json`);
    try {
      fs.writeFileSync(malformedFile, '{ this is not valid json !!!', 'utf8');
      const result = readCache(malformedFile);
      assert.deepEqual(result, []);
    } finally {
      if (fs.existsSync(malformedFile)) fs.unlinkSync(malformedFile);
    }
  });

  it('Tasks with all fields are preserved correctly on write/read round-trip', () => {
    const fullTask = {
      id: 'task-abc-123',
      title: 'Complete the report',
      status: 'inprogress',
      source: 'jira',
      sourceId: 'PROJ-42',
      priority: 'high',
      dueDate: '2026-06-30',
      updatedAt: '2026-06-01T10:00:00.000Z',
      url: 'https://jira.example.com/browse/PROJ-42',
      labels: ['backend', 'urgent'],
    };
    const roundTripFile = path.join(os.tmpdir(), `focusboard-roundtrip-${Date.now()}.json`);
    try {
      writeCache(roundTripFile, [fullTask]);
      const result = readCache(roundTripFile);
      assert.equal(result.length, 1);
      assert.equal(result[0].id, fullTask.id);
      assert.equal(result[0].title, fullTask.title);
      assert.equal(result[0].status, fullTask.status);
      assert.equal(result[0].source, fullTask.source);
      assert.equal(result[0].sourceId, fullTask.sourceId);
      assert.equal(result[0].priority, fullTask.priority);
      assert.equal(result[0].dueDate, fullTask.dueDate);
      assert.equal(result[0].updatedAt, fullTask.updatedAt);
      assert.equal(result[0].url, fullTask.url);
      assert.deepEqual(result[0].labels, fullTask.labels);
    } finally {
      if (fs.existsSync(roundTripFile)) fs.unlinkSync(roundTripFile);
    }
  });
});
