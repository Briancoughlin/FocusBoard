import React, { useState } from 'react';
import { X, Bug, ExternalLink, AlertCircle } from 'lucide-react';

interface Props {
  onClose: () => void;
}

type Phase = 'form' | 'loading' | 'success' | 'error';

export function BugReportModal({ onClose }: Props) {
  const [description, setDescription] = useState('');
  const [phase, setPhase] = useState<Phase>('form');
  const [issueUrl, setIssueUrl] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;

    setPhase('loading');

    try {
      const res = await fetch('/api/bug-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          description: description.trim(),
          userAgent: navigator.userAgent,
        }),
      });
      const data = await res.json();
      if (data.success && data.issueUrl) {
        setIssueUrl(data.issueUrl);
        setPhase('success');
      } else {
        setErrorMsg(data.error || 'Unknown error');
        setPhase('error');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setPhase('error');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-md rounded-xl shadow-2xl p-6 flex flex-col gap-4"
        style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bug size={18} style={{ color: 'var(--text-secondary)' }} />
            <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              Report a Bug
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md transition-colors hover:bg-gray-100"
            style={{ color: 'var(--text-secondary)' }}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form phase */}
        {phase === 'form' && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="bug-description"
                className="text-sm font-medium"
                style={{ color: 'var(--text-secondary)' }}
              >
                What were you doing when this happened?
              </label>
              <textarea
                id="bug-description"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Describe what you were doing and what went wrong..."
                rows={5}
                required
                className="w-full rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2"
                style={{
                  backgroundColor: 'var(--bg)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                  focusRingColor: 'var(--accent)',
                }}
              />
            </div>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              The last 100 lines of the server log will be attached automatically.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-gray-100"
                style={{ color: 'var(--text-secondary)' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!description.trim()}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                Submit Bug Report
              </button>
            </div>
          </form>
        )}

        {/* Loading phase */}
        {phase === 'loading' && (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Creating GitHub issue...
            </p>
          </div>
        )}

        {/* Success phase */}
        {phase === 'success' && (
          <div className="flex flex-col gap-4">
            <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
              Bug report submitted. A GitHub issue has been created:
            </p>
            <a
              href={issueUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm font-medium break-all hover:underline"
              style={{ color: 'var(--accent)' }}
            >
              <ExternalLink size={14} />
              {issueUrl}
            </a>
            <div className="flex justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* Error phase */}
        {phase === 'error' && (
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-2 rounded-lg p-3" style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <AlertCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
              <p className="text-sm text-red-600 break-words">{errorMsg}</p>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-gray-100"
                style={{ color: 'var(--text-secondary)' }}
              >
                Cancel
              </button>
              <button
                onClick={() => setPhase('form')}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                Try Again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
