import React from 'react';
import { ExternalLink, X } from 'lucide-react';
import type { Task } from '../types';

interface Props {
  task: Task;
  onOpen: () => void;
  onDismiss: () => void;
}

export function JiraDonePrompt({ task, onOpen, onDismiss }: Props) {
  return (
    <div className="fixed bottom-6 right-6 z-50 w-80 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden animate-slide-up">
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-3 flex items-center justify-between">
        <p className="text-white font-medium text-sm">Mark done in Jira?</p>
        <button onClick={onDismiss} className="text-white/70 hover:text-white transition-colors">
          <X size={16} />
        </button>
      </div>
      <div className="p-4">
        <p className="text-sm text-gray-700 font-medium line-clamp-2 mb-3">{task.title}</p>
        <div className="flex gap-2">
          <button
            onClick={onOpen}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <ExternalLink size={14} />
            Open in Jira
          </button>
          <button
            onClick={onDismiss}
            className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg transition-colors"
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}
