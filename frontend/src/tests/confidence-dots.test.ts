/**
 * Tests for ConfidenceDots level calculation logic from components/InboxSidebar.tsx
 * The level calculation is extracted as a pure function since ConfidenceDots is
 * not exported and requires no DOM rendering to test the logic.
 */

import { describe, test, expect } from 'vitest';

// Logic extracted from ConfidenceDots in InboxSidebar.tsx:
// const level = confidence >= 0.8 ? 3 : confidence >= 0.55 ? 2 : 1;
function getConfidenceLevel(confidence: number): number {
  return confidence >= 0.8 ? 3 : confidence >= 0.55 ? 2 : 1;
}

describe('ConfidenceDots level calculation', () => {
  test('confidence >= 0.8 returns level 3 (high, green)', () => {
    expect(getConfidenceLevel(0.9)).toBe(3);
    expect(getConfidenceLevel(1.0)).toBe(3);
  });

  test('confidence >= 0.55 and < 0.8 returns level 2 (medium, amber)', () => {
    expect(getConfidenceLevel(0.6)).toBe(2);
    expect(getConfidenceLevel(0.7)).toBe(2);
  });

  test('confidence < 0.55 returns level 1 (low, grey)', () => {
    expect(getConfidenceLevel(0.3)).toBe(1);
    expect(getConfidenceLevel(0.0)).toBe(1);
  });

  test('confidence exactly 0.8 returns level 3 (boundary)', () => {
    expect(getConfidenceLevel(0.8)).toBe(3);
  });

  test('confidence exactly 0.55 returns level 2 (boundary)', () => {
    expect(getConfidenceLevel(0.55)).toBe(2);
  });
});
