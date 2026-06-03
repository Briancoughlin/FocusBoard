import React, { useState } from 'react';
import { Sparkles, X, Loader2, ClipboardPaste } from 'lucide-react';
import type { Task } from '../types';

interface Props {
  onTasksExtracted: (tasks: Task[]) => void;
  onClose: () => void;
}

export function PastePanel({ onTasksExtracted, onClose }: Props) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleExtract = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/paste', { credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      onTasksExtracted(data.tasks || []);
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="bg-gradient-to-br from-violet-500 to-purple-600 p-1.5 rounded-lg">
              <ClipboardPaste size={16} className="text-white" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Quick Add from Text</h2>
              <p className="text-xs text-gray-400">Paste Zoom summaries, meeting notes, emails — Claude extracts the action items</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          <textarea
            autoFocus
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Paste your Zoom summary, meeting notes, email thread, or any text with action items..."
            className="w-full h-48 px-3 py-2.5 text-sm border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent bg-gray-50 placeholder-gray-400"
          />
          {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 pb-5">
          <p className="text-xs text-gray-400">
            {text.length > 0 ? `${text.length} characters` : 'No Anthropic key? A single card will be created instead.'}
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleExtract}
              disabled={!text.trim() || loading}
              className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-lg disabled:opacity-40 transition-colors"
            >
              {loading
                ? <Loader2 size={14} className="animate-spin" />
                : <Sparkles size={14} />}
              {loading ? 'Extracting...' : 'Extract Tasks'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
