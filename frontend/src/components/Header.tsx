import React from 'react';
import { RefreshCw, Settings, Zap, ClipboardPaste, Trophy, Newspaper } from 'lucide-react';

interface Props {
  view: 'board' | 'focus' | 'settings';
  onViewChange: (v: 'board' | 'focus' | 'settings') => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  lastSynced: Date | null;
  onPaste: () => void;
  onShowDigest: () => void;
  completedToday: number;
}

function formatLastSynced(d: Date | null): string {
  if (!d) return 'Never synced';
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diffSec < 10) return 'Just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function Header({ view, onViewChange, onRefresh, isRefreshing, lastSynced, onPaste, onShowDigest, completedToday }: Props) {
  return (
    <header className="px-6 py-3 flex items-center justify-between shadow-sm sticky top-0 z-10" style={{ backgroundColor: 'var(--bg-header)', borderBottom: '1px solid var(--border)' }}>
      {/* Left: Brand */}
      <div className="flex items-center gap-2">
        <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-1.5 rounded-lg">
          <Zap size={18} className="text-white" strokeWidth={2.5} />
        </div>
        <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          FocusBoard
        </span>
        <span className="text-xs text-gray-400 font-normal ml-1 hidden sm:inline">
          ADHD Task Aggregator
        </span>
      </div>

      {/* Center: Nav tabs */}
      <nav className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
        {(['board', 'focus', 'settings'] as const).map(v => (
          <button
            key={v}
            onClick={() => onViewChange(v)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all capitalize ${
              view === v
                ? 'text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            style={view === v ? { backgroundColor: 'var(--accent)' } : {}}
          >
            {v === 'board' ? 'Backlog' : v === 'focus' ? 'Focus' : 'Settings'}
          </button>
        ))}
      </nav>

      {/* Right: sync info + actions */}
      <div className="flex items-center gap-3">
        {completedToday > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 rounded-lg" title="Tasks completed today">
            <Trophy size={14} className="text-emerald-500" />
            <span className="text-sm font-semibold text-emerald-600">{completedToday}</span>
            <span className="text-xs text-emerald-500 hidden sm:inline">done today</span>
          </div>
        )}
        <span className="text-xs text-gray-400 hidden sm:inline">
          {formatLastSynced(lastSynced)}
        </span>
        <button
          onClick={onShowDigest}
          title="Show daily digest"
          className="p-2 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-all"
        >
          <Newspaper size={16} />
        </button>
        <button
          onClick={onPaste}
          title="Paste notes or Zoom summary"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-violet-50 text-violet-600 hover:bg-violet-100 transition-all"
        >
          <ClipboardPaste size={15} />
          <span className="hidden sm:inline">Quick Add</span>
        </button>
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          title="Refresh all sources"
          className={`p-2 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-all ${
            isRefreshing ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
        </button>
        <button
          onClick={() => onViewChange('settings')}
          title="Settings"
          className={`p-2 rounded-lg transition-all ${
            view === 'settings'
              ? 'text-blue-600 bg-blue-50'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
          }`}
        >
          <Settings size={16} />
        </button>
      </div>
    </header>
  );
}
