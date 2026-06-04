import React, { useState } from 'react';
import { X, Loader2, CheckCircle } from 'lucide-react';
import type { Task } from '../types';

interface Props {
  task: Task;
  onOpen: () => void;
  onDismiss: () => void;
}

export function JiraDonePrompt({ task, onOpen, onDismiss }: Props) {
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!task.ticketKey) { onOpen(); return; }
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/jira/comment', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueKey: task.ticketKey, comment: comment.trim() || 'Marked as done via FocusBoard.' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add comment');
      onDismiss();
    } catch (err: any) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 w-80 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden animate-slide-up">
      <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle size={15} className="text-white" />
          <p className="text-white font-medium text-sm">Add closing comment?</p>
        </div>
        <button onClick={onDismiss} className="text-white/70 hover:text-white transition-colors" aria-label="Close prompt">
          <X size={16} aria-hidden="true" />
        </button>
      </div>
      <div className="p-4">
        <p className="text-xs font-mono text-blue-400 mb-1">{task.ticketKey}</p>
        <p className="text-sm text-gray-700 font-medium line-clamp-2 mb-3">{task.title}</p>
        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder="What was completed? (optional)"
          rows={3}
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-400 mb-3"
          style={{ backgroundColor: 'var(--bg)' }}
          autoFocus
        />
        {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            aria-label="Add comment and close"
          >
            {submitting ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />}
            {submitting ? 'Saving...' : 'Add Comment'}
          </button>
          <button
            onClick={onDismiss}
            className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg transition-colors"
            aria-label="Skip comment"
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}
