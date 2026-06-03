import React, { useState, useEffect } from 'react';
import { Mail, Hash, ExternalLink, Plus, Inbox } from 'lucide-react';
import type { Task } from '../types';
import { getPersistedValue, setPersistedValue } from '../services/persistence';

interface InboxItem {
  id: string;
  source: 'gmail' | 'slack';
  title: string;
  preview?: string;
  url?: string;
  receivedAt: string;
  read: boolean;
}

interface Props {
  tasks: Task[];
  onAddToBoard: (item: InboxItem) => void;
}

function timeAgo(dateStr: string): string {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function InboxSidebar({ tasks, onAddToBoard }: Props) {
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    getPersistedValue<string[]>('inbox-read', []).then(ids => {
      setReadIds(new Set(ids));
    });
  }, []);

  const markRead = (id: string) => {
    setReadIds(prev => {
      const next = new Set(prev).add(id);
      setPersistedValue('inbox-read', [...next]);
      return next;
    });
  };

  // Build inbox items from gmail + slack tasks
  const inboxItems: InboxItem[] = tasks
    .filter(t => t.source === 'gmail' || t.source === 'slack')
    .map(t => ({
      id: t.id,
      source: t.source as 'gmail' | 'slack',
      title: t.title,
      preview: t.description,
      url: t.url,
      receivedAt: t.updatedAt,
      read: readIds.has(t.id),
    }))
    .sort((a, b) => {
      // Slack items always first
      if (a.source === 'slack' && b.source !== 'slack') return -1;
      if (b.source === 'slack' && a.source !== 'slack') return 1;
      return new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime();
    });

  const unreadCount = inboxItems.filter(i => !i.read).length;

  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-200 w-64 flex-shrink-0">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Inbox size={15} className="text-gray-500" />
          <span className="text-sm font-semibold text-gray-700">Inbox</span>
          {unreadCount > 0 && (
            <span className="text-xs font-bold px-1.5 py-0.5 bg-blue-500 text-white rounded-full">
              {unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => {
              const next = new Set([...readIds, ...inboxItems.map(i => i.id)]);
              setReadIds(next);
              setPersistedValue('inbox-read', [...next]);
            }}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            Mark all read
          </button>
        )}
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto">
        {inboxItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <Inbox size={28} className="text-gray-200 mb-2" />
            <p className="text-sm font-medium text-gray-400">No messages yet</p>
            <p className="text-xs text-gray-300 mt-1">Gmail and Slack items will appear here once connected</p>
          </div>
        ) : (
          inboxItems.map(item => (
            <div
              key={item.id}
              onClick={() => markRead(item.id)}
              className={`px-3 py-3 border-b cursor-pointer transition-colors ${
                item.read ? 'opacity-50' : ''
              } ${
                item.source === 'slack' && !item.read
                  ? 'bg-purple-50 border-purple-100 hover:bg-purple-100'
                  : 'border-gray-50 hover:bg-gray-50'
              }`}
            >
              {/* Source + time */}
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  {item.source === 'gmail'
                    ? <Mail size={11} className="text-red-400" />
                    : <Hash size={11} className="text-purple-400" />
                  }
                  <span className={`text-xs font-medium ${item.source === 'gmail' ? 'text-red-400' : 'text-purple-400'}`}>
                    {item.source === 'gmail' ? 'Gmail' : 'Slack'}
                  </span>
                  {!item.read && (
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                  )}
                </div>
                <span className="text-xs text-gray-300">{timeAgo(item.receivedAt)}</span>
              </div>

              {/* Title */}
              <p className="text-xs font-semibold text-gray-800 line-clamp-2 leading-snug mb-1">
                {item.title}
              </p>

              {/* Preview */}
              {item.preview && (
                <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">
                  {item.preview}
                </p>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={e => { e.stopPropagation(); onAddToBoard(item); markRead(item.id); }}
                  className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 font-medium transition-colors"
                  title="Add to board as task"
                >
                  <Plus size={11} />
                  Add to board
                </button>
                {item.url && (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => { e.stopPropagation(); markRead(item.id); }}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <ExternalLink size={11} />
                    Open
                  </a>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
