import React, { useState } from 'react';
import { ArrowUpCircle, X, Loader2 } from 'lucide-react';

export interface UpdateInfo {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseUrl: string;
  releaseName: string;
  releaseNotes: string;
}

interface Props {
  update: UpdateInfo;
  onDismiss: () => void;
}

export function UpdateBanner({ update, onDismiss }: Props) {
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);

  const handleApply = async () => {
    setApplying(true);
    try {
      await fetch('/api/update/apply', { method: 'POST', credentials: 'include' });
      setApplied(true);
      // Reload after a few seconds to pick up the new version
      setTimeout(() => window.location.reload(), 8000);
    } catch {
      setApplying(false);
    }
  };

  if (applied) {
    return (
      <div className="px-4 py-2 text-sm text-center font-medium text-white" style={{ backgroundColor: '#10b981' }}>
        ✅ Updating FocusBoard — reloading in a few seconds...
      </div>
    );
  }

  return (
    <div className="px-4 py-2 flex items-center justify-between text-sm" style={{ backgroundColor: 'var(--accent)', color: '#fff' }}>
      <div className="flex items-center gap-2">
        <ArrowUpCircle size={15} aria-hidden="true" />
        <span>
          <strong>{update.latestVersion}</strong> is available — you're on {update.currentVersion}
        </span>
        <a
          href={update.releaseUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="underline opacity-80 hover:opacity-100 text-xs"
        >
          What's new
        </a>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={handleApply}
          disabled={applying}
          className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-white/20 hover:bg-white/30 transition-colors disabled:opacity-50"
          aria-label="Apply update and restart"
        >
          {applying ? <Loader2 size={12} className="animate-spin" /> : <ArrowUpCircle size={12} />}
          {applying ? 'Updating...' : 'Update now'}
        </button>
        <button onClick={onDismiss} className="opacity-70 hover:opacity-100 transition-opacity" aria-label="Dismiss update notification">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
