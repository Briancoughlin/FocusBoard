/**
 * @file LeaderboardModal.tsx
 * Daily productivity high-score leaderboard.
 * Shows the last 30 days ranked by tasks completed, with today highlighted
 * and the personal best starred.
 */

import React from 'react';
import { Trophy, X, Star, Flame } from 'lucide-react';

interface Props {
  scores: Record<string, number>; // { "Mon Jun 02 2026": 5, ... }
  onClose: () => void;
}

function formatDay(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';

  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

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

export function LeaderboardModal({ scores, onClose }: Props) {
  const today = new Date().toDateString();

  // Sort days by score descending, then by date descending for ties
  const ranked = Object.entries(scores)
    .filter(([, count]) => count > 0)
    .sort(([dateA, countA], [dateB, countB]) => {
      if (countB !== countA) return countB - countA;
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });

  const personalBest = ranked[0]?.[1] ?? 0;
  const todayScore = scores[today] ?? 0;
  const totalCompleted = Object.values(scores).reduce((sum, n) => sum + n, 0);
  const streak = getStreakCount(scores);

  // For display: show all days that have a score, sorted by rank
  const displayRows = ranked.map(([dateStr, count], idx) => ({
    dateStr,
    count,
    rank: idx + 1,
    isToday: dateStr === today,
    isPB: count === personalBest && idx === 0,
  }));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="leaderboard-title"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="rounded-2xl shadow-2xl w-full max-w-md flex flex-col"
        style={{ backgroundColor: 'var(--bg-card)', maxHeight: '80vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2">
            <Trophy size={20} className="text-emerald-500" />
            <h2 id="leaderboard-title" className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              Productivity Leaderboard
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close leaderboard"
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
          >
            <X size={16} />
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="text-center">
            <div className="text-2xl font-bold text-emerald-500">{todayScore}</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>today</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold" style={{ color: 'var(--accent)' }}>{personalBest}</div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>personal best</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-500 flex items-center justify-center gap-1">
              {streak > 0 && <Flame size={18} />}{streak}
            </div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>day streak</div>
          </div>
        </div>

        {/* Leaderboard rows */}
        <div className="flex-1 overflow-y-auto px-6 py-3 space-y-1.5">
          {displayRows.length === 0 && (
            <div className="text-center py-8" style={{ color: 'var(--text-secondary)' }}>
              <Trophy size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No scores yet — complete some tasks to get on the board!</p>
            </div>
          )}
          {displayRows.map(({ dateStr, count, rank, isToday, isPB }) => (
            <div
              key={dateStr}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all"
              style={{
                backgroundColor: isToday
                  ? 'rgba(16, 185, 129, 0.08)'
                  : 'var(--bg)',
                border: isToday ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid transparent',
              }}
            >
              {/* Rank */}
              <div className="w-8 text-center flex-shrink-0">
                {getMedal(rank) ? (
                  <span className="text-lg">{getMedal(rank)}</span>
                ) : (
                  <span className="text-sm font-mono font-medium" style={{ color: 'var(--text-secondary)' }}>
                    #{rank}
                  </span>
                )}
              </div>

              {/* Day label */}
              <div className="flex-1 min-w-0">
                <span
                  className="text-sm font-medium"
                  style={{ color: isToday ? 'var(--accent)' : 'var(--text-primary)' }}
                >
                  {formatDay(dateStr)}
                </span>
                {isToday && (
                  <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-600 font-medium">
                    live
                  </span>
                )}
              </div>

              {/* PB star */}
              {isPB && (
                <Star size={13} className="text-amber-400 fill-amber-400 flex-shrink-0" aria-label="Personal best" />
              )}

              {/* Score bar */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <div
                  className="h-1.5 rounded-full bg-emerald-400 transition-all"
                  style={{ width: `${Math.round((count / personalBest) * 60)}px`, minWidth: '4px' }}
                  aria-hidden="true"
                />
                <span className="text-sm font-bold w-5 text-right" style={{ color: 'var(--text-primary)' }}>
                  {count}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t text-center" style={{ borderColor: 'var(--border)' }}>
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {totalCompleted} total tasks completed all time
          </span>
        </div>
      </div>
    </div>
  );
}
