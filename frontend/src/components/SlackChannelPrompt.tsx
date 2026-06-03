import React, { useState } from 'react';
import { Hash, X } from 'lucide-react';

interface Props {
  channelName: string;
  onSave: (channelName: string, channelId: string) => void;
  onDismiss: () => void;
}

export function SlackChannelPrompt({ channelName, onSave, onDismiss }: Props) {
  const [channelId, setChannelId] = useState('');

  return (
    <div className="fixed bottom-6 right-80 z-50 w-80 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden animate-slide-up">
      <div className="bg-gradient-to-r from-purple-500 to-purple-600 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Hash size={15} className="text-white" />
          <p className="text-white font-medium text-sm">Add channel ID?</p>
        </div>
        <button onClick={onDismiss} className="text-white/70 hover:text-white transition-colors">
          <X size={16} />
        </button>
      </div>
      <div className="p-4">
        <p className="text-sm text-gray-600 mb-3">
          Add the ID for <span className="font-semibold text-purple-600">#{channelName}</span> to enable direct links.
        </p>
        <p className="text-xs text-gray-400 mb-2">
          Find it in Slack web URL: app.slack.com/client/TEAM/<span className="font-mono font-bold">CHANNEL_ID</span>
        </p>
        <input
          autoFocus
          type="text"
          value={channelId}
          onChange={e => setChannelId(e.target.value)}
          placeholder="e.g. C06AF9683"
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 mb-3"
          onKeyDown={e => { if (e.key === 'Enter' && channelId.trim()) onSave(channelName, channelId.trim()); }}
        />
        <div className="flex gap-2">
          <button
            onClick={() => { if (channelId.trim()) onSave(channelName, channelId.trim()); }}
            disabled={!channelId.trim()}
            className="flex-1 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg disabled:opacity-40 transition-colors"
          >
            Save
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
