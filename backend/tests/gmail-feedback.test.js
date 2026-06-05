/**
 * Tests for the gmail feedback POST logic from routes/gmail.js
 * The functions are copied here since they are not exported from the module.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// --- Pure logic extracted from router.post('/feedback', ...) ---

function validateFeedbackInput({ taskId }) {
  if (!taskId || typeof taskId !== 'string' || taskId.length > 200) {
    return { error: 'taskId required and must be a string under 200 chars' };
  }
  return null;
}

function extractSenderEmail(from) {
  return (from || '').toLowerCase().replace(/.*<|>/g, '').trim();
}

function sanitizeInputs({ from = '', subject = '', confidence = 0.8 }) {
  const safeFrom    = String(from).slice(0, 500);
  const safeSubject = String(subject).slice(0, 500);
  const safeConf    = typeof confidence === 'number' ? Math.max(0, Math.min(1, confidence)) : 0.8;
  return { safeFrom, safeSubject, safeConf };
}

function buildNoisePatterns(feedbackEntries) {
  const entries = feedbackEntries.filter(e => e.verdict === 'not_action');
  const senderCounts = {};
  const subjectCounts = {};
  for (const e of entries) {
    const sender = (e.from || '').toLowerCase().replace(/.*<|>/g, '').trim();
    if (sender) senderCounts[sender] = (senderCounts[sender] || 0) + 1;
    const stopWords = new Set(['re:', 'fw:', 'fwd:', 'the', 'and', 'for', 'you', 'your', 'with', 'this', 'that']);
    const words = (e.subject || '').toLowerCase().split(/\s+/).filter(w => w.length >= 3 && !stopWords.has(w));
    for (const word of words.slice(0, 3)) {
      subjectCounts[word] = (subjectCounts[word] || 0) + 1;
    }
  }
  const totalFeedback = entries.length || 1;
  const patterns = [
    ...Object.entries(senderCounts)
      .filter(([, c]) => c >= 2)
      .map(([pattern, count]) => ({ type: 'sender', pattern, count, falsePositiveRate: Math.min(0.95, count / totalFeedback) })),
    ...Object.entries(subjectCounts)
      .filter(([, c]) => c >= 3)
      .map(([pattern, count]) => ({ type: 'subject', pattern, count, falsePositiveRate: Math.min(0.95, count / totalFeedback) })),
  ].sort((a, b) => b.falsePositiveRate - a.falsePositiveRate).slice(0, 20);
  return patterns;
}

// --- Tests ---

describe('input validation', () => {
  it('missing taskId returns error', () => {
    const result = validateFeedbackInput({ taskId: undefined });
    assert.ok(result);
    assert.equal(result.error, 'taskId required and must be a string under 200 chars');
  });

  it('taskId over 200 chars is rejected', () => {
    const result = validateFeedbackInput({ taskId: 'a'.repeat(201) });
    assert.ok(result);
    assert.equal(result.error, 'taskId required and must be a string under 200 chars');
  });

  it('valid taskId with all fields is accepted', () => {
    const result = validateFeedbackInput({ taskId: 'task-abc-123' });
    assert.equal(result, null);
  });
});

describe('sender email extraction', () => {
  it('extracts email from angle bracket format', () => {
    const result = extractSenderEmail('Brian Coughlin <brian@company.com>');
    assert.equal(result, 'brian@company.com');
  });

  it('passes through bare email with no angle brackets', () => {
    const result = extractSenderEmail('noreply@alerts.com');
    assert.equal(result, 'noreply@alerts.com');
  });
});

describe('noise pattern building', () => {
  it('sender with 2 feedback entries is included in patterns', () => {
    const entries = [
      { verdict: 'not_action', from: 'alerts@system.com', subject: '' },
      { verdict: 'not_action', from: 'alerts@system.com', subject: '' },
    ];
    const patterns = buildNoisePatterns(entries);
    const senderPatterns = patterns.filter(p => p.type === 'sender');
    assert.equal(senderPatterns.length, 1);
    assert.equal(senderPatterns[0].pattern, 'alerts@system.com');
  });

  it('sender with only 1 feedback entry is NOT included in patterns', () => {
    const entries = [
      { verdict: 'not_action', from: 'once@system.com', subject: '' },
    ];
    const patterns = buildNoisePatterns(entries);
    const senderPatterns = patterns.filter(p => p.type === 'sender');
    assert.equal(senderPatterns.length, 0);
  });

  it('falsePositiveRate is clamped to max 0.95', () => {
    // If one sender appears as all entries, rate would be 1.0 — must be clamped to 0.95
    const entries = Array.from({ length: 5 }, () => ({
      verdict: 'not_action',
      from: 'spam@example.com',
      subject: '',
    }));
    const patterns = buildNoisePatterns(entries);
    const senderPatterns = patterns.filter(p => p.type === 'sender');
    assert.equal(senderPatterns.length, 1);
    assert.ok(senderPatterns[0].falsePositiveRate <= 0.95);
  });
});

describe('input sanitization', () => {
  it('from longer than 500 chars gets sliced to 500', () => {
    const longFrom = 'a'.repeat(600);
    const { safeFrom } = sanitizeInputs({ from: longFrom });
    assert.equal(safeFrom.length, 500);
  });

  it('confidence outside 0-1 range gets clamped', () => {
    const { safeConf: high } = sanitizeInputs({ confidence: 1.5 });
    assert.equal(high, 1.0);

    const { safeConf: low } = sanitizeInputs({ confidence: -0.5 });
    assert.equal(low, 0);
  });
});
