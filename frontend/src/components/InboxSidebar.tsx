import React, { useState, useEffect } from 'react';
import { Mail, Hash, ExternalLink, Plus, Inbox, Github } from 'lucide-react';
import type { Task } from '../types';
import { getPersistedValue, setPersistedValue } from '../services/persistence';

interface InboxItem {
  id: string;
  source: 'gmail' | 'slack' | 'github';
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

function ItemRow({ item, onRead, onAddToBoard }: {
  item: InboxItem;
  onRead: (id: string) => void;
  onAddToBoard: (item: InboxItem) => void;
}) {
  return (
    <div
      onClick={() => { onRead(item.id); if (item.url) window.open(item.url, '_blank'); }}
      className={`px-3 py-2.5 border-b cursor-pointer transition-colors ${item.read ? 'opacity-40' : ''} ${
        item.source === 'slack' && !item.read ? 'bg-purple-50 border-purple-100 hover:bg-purple-100' :
        item.source === 'github' && !item.read && item.title.includes('❌') ? 'bg-red-50 border-red-100 hover:bg-red-100' :
        item.source === 'github' && !item.read && item.title.includes('✅') ? 'bg-green-50 border-green-100 hover:bg-green-100' :
        ''
      }`}
      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)' }}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          {item.source === 'gmail' ? <Mail size={10} className="text-red-400" /> :
           item.source === 'slack' ? <Hash size={10} className="text-purple-400" /> :
           <Github size={10} className="text-gray-600" />}
          {!item.read && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />}
        </div>
        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{timeAgo(item.receivedAt)}</span>
      </div>
      <p className="text-xs font-semibold line-clamp-2 leading-snug mb-1" style={{ color: 'var(--text-primary)' }}>{item.title}</p>
      {item.preview && (
        <p className="text-xs line-clamp-1 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{item.preview}</p>
      )}
      <div className="flex items-center gap-2 mt-1.5">
        <button
          onClick={e => { e.stopPropagation(); onAddToBoard(item); onRead(item.id); }}
          className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 font-medium transition-colors"
        >
          <Plus size={10} /> Add to board
        </button>
        {item.url && (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => { e.stopPropagation(); onRead(item.id); }}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            <ExternalLink size={10} /> Open
          </a>
        )}
      </div>
    </div>
  );
}

function SectionHeader({ icon, title, count, onMarkAll }: {
  icon: React.ReactNode;
  title: string;
  count: number;
  onMarkAll?: () => void;
}) {
  return (
    <div className="px-3 py-2 flex items-center justify-between sticky top-0 z-10" style={{ backgroundColor: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border)' }}>
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>{title}</span>
        {count > 0 && (
          <span className="text-xs font-bold px-1.5 py-0.5 bg-blue-500 text-white rounded-full">{count}</span>
        )}
      </div>
      {count > 0 && onMarkAll && (
        <button onClick={onMarkAll} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
          All read
        </button>
      )}
    </div>
  );
}

export function InboxSidebar({ tasks, onAddToBoard }: Props) {
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    getPersistedValue<string[]>('inbox-read', []).then(ids => setReadIds(new Set(ids)));
  }, []);

  const markRead = (id: string) => {
    setReadIds(prev => {
      const next = new Set(prev).add(id);
      setPersistedValue('inbox-read', [...next]);
      return next;
    });
  };

  const markAllRead = (ids: string[]) => {
    setReadIds(prev => {
      const next = new Set([...prev, ...ids]);
      setPersistedValue('inbox-read', [...next]);
      return next;
    });
  };

  const toItem = (t: Task): InboxItem => ({
    id: t.id,
    source: t.source as 'gmail' | 'slack' | 'github',
    title: t.title,
    preview: t.description,
    url: t.url,
    receivedAt: t.updatedAt,
    read: readIds.has(t.id),
  });

  const githubItems = tasks
    .filter(t => t.source === 'github')
    .map(toItem)
    .filter(i => !i.read)
    .sort((a, b) => {
      const p = (i: InboxItem) => i.title.includes('❌') ? 0 : i.title.includes('👀') ? 1 : 2;
      if (p(a) !== p(b)) return p(a) - p(b);
      return new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime();
    });

  const inboxItems = tasks
    .filter(t => t.source === 'gmail' || t.source === 'slack')
    .map(toItem)
    .filter(i => !i.read)
    .sort((a, b) => {
      if (a.source === 'slack' && b.source !== 'slack') return -1;
      if (b.source === 'slack' && a.source !== 'slack') return 1;
      return new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime();
    });

  const githubUnread = githubItems.filter(i => !i.read).length;
  const inboxUnread = inboxItems.filter(i => !i.read).length;
  const totalUnread = githubUnread + inboxUnread;

  return (
    <div className="flex flex-col h-full w-64 flex-shrink-0" style={{ backgroundColor: 'var(--bg-sidebar)', borderLeft: '1px solid var(--border)' }}>

      {/* Top bar */}
      <div className="px-3 py-2.5 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
        <Inbox size={14} className="text-gray-500" />
        <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Notifications</span>
        {totalUnread > 0 && (
          <span className="text-xs font-bold px-1.5 py-0.5 bg-blue-500 text-white rounded-full ml-auto">{totalUnread}</span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">

        {/* GitHub section */}
        <SectionHeader
          icon={<Github size={12} className="text-gray-600" />}
          title="GitHub"
          count={githubUnread}
          onMarkAll={() => markAllRead(githubItems.map(i => i.id))}
        />
        {githubItems.length === 0 ? (
          <div className="px-3 py-4 text-center" style={{ backgroundColor: 'var(--bg-card)' }}>
            <p className="text-xs" style={{ color: 'var(--border)' }}>No GitHub notifications</p>
          </div>
        ) : (
          githubItems.map(item => (
            <ItemRow key={item.id} item={item} onRead={markRead} onAddToBoard={onAddToBoard} />
          ))
        )}

        {/* Inbox section */}
        <SectionHeader
          icon={<Inbox size={12} className="text-gray-500" />}
          title="Inbox"
          count={inboxUnread}
          onMarkAll={() => markAllRead(inboxItems.map(i => i.id))}
        />
        {inboxItems.length === 0 ? (
          <div className="px-3 py-4 text-center" style={{ backgroundColor: 'var(--bg-card)' }}>
            <p className="text-xs" style={{ color: 'var(--border)' }}>No messages yet</p>
            <p className="text-xs mt-1" style={{ color: 'var(--border)' }}>Gmail & Slack appear here</p>
          </div>
        ) : (
          inboxItems.map(item => (
            <ItemRow key={item.id} item={item} onRead={markRead} onAddToBoard={onAddToBoard} />
          ))
        )}

      </div>
    </div>
  );
}
