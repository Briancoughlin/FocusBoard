/**
 * Tests for leaderboard scoring logic from components/LeaderboardModal.tsx
 * getMedal, getStreakCount, and ranking/sorting logic are copied here
 * since they are not exported from the module.
 */

import { describe, test, expect } from 'vitest';

// Copied from LeaderboardModal.tsx
function getMedal(rank: number): string {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return '';
}

function getStreakCount(scores: Record<string, number>): number {
  const today = new Date();
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toDateString();
    if ((scores[key] ?? 0) > 0) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }
  return streak;
}

function rankScores(scores: Record<string, number>) {
  return Object.entries(scores)
    .filter(([, count]) => count > 0)
    .sort(([dateA, countA], [dateB, countB]) => {
      if (countB !== countA) return countB - countA;
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });
}

// Helper to build a scores object with consecutive days ending today
function buildConsecutiveScores(dayCount: number, scorePerDay = 3): Record<string, number> {
  const scores: Record<string, number> = {};
  const today = new Date();
  for (let i = 0; i < dayCount; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    scores[d.toDateString()] = scorePerDay;
  }
  return scores;
}

describe('medal assignment', () => {
  test('rank 1 returns gold medal', () => {
    expect(getMedal(1)).toBe('🥇');
  });

  test('rank 2 returns silver medal', () => {
    expect(getMedal(2)).toBe('🥈');
  });

  test('rank 3 returns bronze medal', () => {
    expect(getMedal(3)).toBe('🥉');
  });

  test('rank 4 and above returns empty string', () => {
    expect(getMedal(4)).toBe('');
    expect(getMedal(10)).toBe('');
  });
});

describe('streak calculation', () => {
  test('3 consecutive days with scores returns streak of 3', () => {
    const scores = buildConsecutiveScores(3);
    expect(getStreakCount(scores)).toBe(3);
  });

  test('gap in streak resets count to only days from today backwards without break', () => {
    const today = new Date();
    const scores: Record<string, number> = {};
    // today and yesterday have scores, but 2 days ago has none, 3 days ago has a score
    scores[today.toDateString()] = 2;
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    scores[yesterday.toDateString()] = 1;
    // skip day -2
    const threeDaysAgo = new Date(today);
    threeDaysAgo.setDate(today.getDate() - 3);
    scores[threeDaysAgo.toDateString()] = 5;

    expect(getStreakCount(scores)).toBe(2);
  });

  test('no scores returns streak of 0', () => {
    expect(getStreakCount({})).toBe(0);
  });
});

describe('ranking', () => {
  test('days are sorted by score descending', () => {
    const today = new Date();
    const d1 = today.toDateString();
    const d2 = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1).toDateString();
    const d3 = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 2).toDateString();

    const scores = { [d1]: 3, [d2]: 7, [d3]: 1 };
    const ranked = rankScores(scores);
    expect(ranked[0][1]).toBe(7);
    expect(ranked[1][1]).toBe(3);
    expect(ranked[2][1]).toBe(1);
  });

  test('ties broken by most recent date first', () => {
    const today = new Date();
    const d1 = today.toDateString();
    const d2 = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1).toDateString();

    const scores = { [d1]: 5, [d2]: 5 };
    const ranked = rankScores(scores);
    // d1 (today) should come first as it is more recent
    expect(ranked[0][0]).toBe(d1);
    expect(ranked[1][0]).toBe(d2);
  });
});
