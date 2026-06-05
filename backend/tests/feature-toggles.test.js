/**
 * Tests for the source filtering logic from /api/sync in backend/server.js.
 * The filter line is: const sources = allSources.filter(s => features[s.name] !== false);
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const ALL_SOURCES = [
  { name: 'jira' },
  { name: 'gmail' },
  { name: 'calendar' },
  { name: 'slack' },
  { name: 'github' },
];

// Pure function mirroring the filter line from server.js
function filterSources(allSources, features) {
  return allSources.filter(s => features[s.name] !== false);
}

describe('Feature-toggle source filtering', () => {

  it('all features enabled (default) → all 5 sources included', () => {
    const features = { jira: true, gmail: true, calendar: true, slack: true, github: true };
    const result = filterSources(ALL_SOURCES, features);
    assert.equal(result.length, 5);
  });

  it('features.jira = false → jira excluded, others included', () => {
    const features = { jira: false };
    const result = filterSources(ALL_SOURCES, features);
    assert.equal(result.length, 4);
    assert.ok(!result.some(s => s.name === 'jira'), 'jira should be excluded');
    assert.ok(result.some(s => s.name === 'gmail'), 'gmail should be included');
    assert.ok(result.some(s => s.name === 'github'), 'github should be included');
  });

  it('features.gmail = false && features.github = false → both excluded', () => {
    const features = { gmail: false, github: false };
    const result = filterSources(ALL_SOURCES, features);
    assert.equal(result.length, 3);
    assert.ok(!result.some(s => s.name === 'gmail'), 'gmail should be excluded');
    assert.ok(!result.some(s => s.name === 'github'), 'github should be excluded');
  });

  it('features = {} (empty object, all default) → all 5 sources included', () => {
    const result = filterSources(ALL_SOURCES, {});
    assert.equal(result.length, 5);
  });

  it('features.slack = false → slack excluded', () => {
    const features = { slack: false };
    const result = filterSources(ALL_SOURCES, features);
    assert.equal(result.length, 4);
    assert.ok(!result.some(s => s.name === 'slack'), 'slack should be excluded');
  });

  it('source not in features object → only explicitly disabled sources are excluded', () => {
    // features only disables jira; all others are absent from the object (undefined !== false)
    const features = { jira: false };
    const result = filterSources(ALL_SOURCES, features);
    assert.equal(result.length, 4);
    assert.ok(!result.some(s => s.name === 'jira'), 'jira should be excluded');
    assert.ok(result.some(s => s.name === 'gmail'), 'gmail (not in features) should default to included');
    assert.ok(result.some(s => s.name === 'github'), 'github (not in features) should default to included');
  });

});
