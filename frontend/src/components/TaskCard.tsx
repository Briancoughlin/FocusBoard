import React from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { ExternalLink, Calendar, Flame, X, Pin, Ban } from 'lucide-react';
import type { Task } from '../types';
import { SourceBadge } from './SourceBadge';

interface Props {
  task: Task;
  index: number;
  onDismiss: (taskId: string) => void;
  onPin?: (taskId: string) => void;
  pinned?: boolean;
  onWontDo?: (taskId: string) => void;
}

export type UrgencyLevel = 'overdue' | 'today' | 'soon' | 'normal';

export function getUrgencyScore(task: Task): number {
  if (task.dueDate) {
    const diffDays = (new Date(task.dueDate).getTime() - Date.now()) / 86400000;
    if (diffDays < 0)  return -1000 + diffDays;
    return diffDays;
  }
  // Fall back to priority for tasks without due dates
  if (task.priority === 'high')   return 5;
  if (task.priority === 'medium') return 15;
  if (task.priority === 'low')    return 25;
  // Age-based for Gmail/Slack
  const ageDays = (Date.now() - new Date(task.updatedAt).getTime()) / 86400000;
  return 30 - ageDays;
}

export function getUrgencyLevel(task: Task): UrgencyLevel {
  if (task.dueDate) {
    const diffDays = (new Date(task.dueDate).getTime() - Date.now()) / 86400000;
    if (diffDays < -30) return 'normal'; // ignore ancient due dates from bad AI extraction
    if (diffDays < 0) return 'overdue';
    if (diffDays < 1) return 'today';
    if (diffDays < 4) return 'soon';
    return 'normal';
  }
  // No due date — use priority for the colour strip
  if (task.priority === 'high')   return 'soon';
  if (task.priority === 'medium') return 'normal';
  return 'normal';
}

const urgencyBar: Record<UrgencyLevel, string> = {
  overdue: 'bg-red-500',
  today:   'bg-orange-400',
  soon:    'bg-yellow-400',
  normal:  'bg-transparent',
};

const urgencyLabel: Record<UrgencyLevel, string | null> = {
  overdue: 'Overdue',
  today:   'Due today',
  soon:    null,
  normal:  null,
};

function formatDate(dateStr: string): string {
  const diffDays = (new Date(dateStr).getTime() - Date.now()) / 86400000;
  if (diffDays < 0) return `${Math.ceil(Math.abs(diffDays))}d overdue`;
  if (diffDays < 1) return 'Today';
  if (diffDays < 2) return 'Tomorrow';
  if (diffDays < 7) return `${Math.ceil(diffDays)}d`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function TaskCard({ task, index, onDismiss, onPin, pinned, onWontDo }: Props) {
  const isWontDo = task.status === 'wontdo';
  const urgency = getUrgencyLevel(task);
  const bar = urgencyBar[urgency];
  const badge = urgencyLabel[urgency];

  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          role="article"
          aria-label={task.title}
          className={`
            rounded-lg border mb-2 cursor-grab active:cursor-grabbing
            shadow-sm hover:shadow-md transition-all duration-150 overflow-hidden
            ${task.url ? 'hover:border-blue-300' : ''}
            ${snapshot.isDragging ? 'shadow-lg rotate-1 border-blue-300 ring-2 ring-blue-200' : ''}
          `}
          style={{ ...provided.draggableProps.style, backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', opacity: isWontDo ? 0.6 : 1 }}
        >
          {/* Urgency strip — colour + icon pattern for colourblind accessibility */}
          <div
            className={`h-1.5 w-full flex items-center ${bar}`}
            title={urgency === 'overdue' ? 'Overdue' : urgency === 'today' ? 'Due today' : urgency === 'soon' ? 'Due soon' : undefined}
            aria-hidden="true"
          >
            {urgency === 'overdue' && (
              <span className="text-white text-xs leading-none px-1 font-bold tracking-widest opacity-60">▲▲▲</span>
            )}
            {urgency === 'today' && (
              <span className="text-white text-xs leading-none px-1 font-bold tracking-widest opacity-60">◆◆◆</span>
            )}
            {urgency === 'soon' && (
              <span className="text-yellow-800 text-xs leading-none px-1 font-bold tracking-widest opacity-40">···</span>
            )}
          </div>

          <div className="p-3">
            {/* Top row: source badge + urgency badge + dismiss */}
            <div className="flex items-center justify-between mb-2">
              <span title={`Source: ${task.source}`}><SourceBadge source={task.source} /></span>
              <div className="flex items-center gap-1">
              {badge && (
                <span
                  className={`flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                    urgency === 'overdue' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'
                  }`}
                  aria-label={`Urgency: ${badge}`}
                >
                  <Flame size={10} aria-hidden="true" />
                  {badge}
                </span>
              )}
              {task.priority && task.source === 'jira' && (
                <span
                  className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                    task.priority === 'high'   ? 'bg-red-100 text-red-600' :
                    task.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                                 'bg-gray-100 text-gray-500'
                  }`}
                  title={`Priority: ${task.priority === 'high' ? 'High' : task.priority === 'medium' ? 'Medium' : 'Low'}`}
                >
                  {task.priority === 'high' ? 'High' : task.priority === 'medium' ? 'Med' : 'Low'}
                </span>
              )}
              {onWontDo && (
                <button
                  onClick={e => { e.stopPropagation(); onWontDo(task.id); }}
                  className="transition-colors p-0.5 rounded"
                  style={{ color: isWontDo ? '#ef4444' : 'var(--text-secondary)' }}
                  title={isWontDo ? "Mark as Done instead" : "Mark as Won't Do"}
                  aria-label={isWontDo ? "Mark as Done instead" : "Mark as Won't Do"}
                >
                  <Ban size={12} fill={isWontDo ? '#ef4444' : 'none'} />
                </button>
              )}
              {onPin && (
                <button
                  onClick={e => { e.stopPropagation(); onPin(task.id); }}
                  className="transition-colors p-0.5 rounded"
                  style={{ color: pinned ? '#f59e0b' : 'var(--text-secondary)' }}
                  title={pinned ? 'Unpin from Focus view' : 'Pin to Focus view'}
                  aria-label={pinned ? 'Unpin from Focus view' : 'Pin to Focus view'}
                  aria-pressed={pinned}
                >
                  <Pin size={13} fill={pinned ? '#f59e0b' : 'none'} aria-hidden="true" />
                </button>
              )}
              <button
                onClick={e => { e.stopPropagation(); onDismiss(task.id); }}
                className="transition-colors p-0.5 rounded hover:text-red-400"
                style={{ color: 'var(--text-secondary)' }}
                title="Dismiss this task"
                aria-label="Dismiss this task"
              >
                <X size={12} aria-hidden="true" />
              </button>
              </div>
            </div>

            {/* Blurable content block for privacy mode */}
            <div className="task-content">
            {/* Ticket key + fix version */}
            {task.ticketKey && (
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-xs font-mono text-blue-400" title="Jira ticket key — click title to open">{task.ticketKey}</p>
                {task.fixVersion && (
                  <span className="text-xs px-1 py-0 rounded" style={{ backgroundColor: 'var(--accent-light)', color: 'var(--accent)' }} title={`Fix version: ${task.fixVersion}`}>
                    {task.fixVersion}
                  </span>
                )}
              </div>
            )}

            {/* Title — click to open */}
            <p
              onClick={e => { e.stopPropagation(); if (task.url) window.open(task.url, '_blank'); }}
              className={`text-sm font-semibold leading-snug mb-1 line-clamp-2 ${task.url ? 'hover:text-blue-600 cursor-pointer' : ''} ${isWontDo ? 'line-through' : ''}`}
              style={{ color: isWontDo ? 'var(--text-secondary)' : 'var(--text-primary)' }}
            >
              {isWontDo && <span className="text-xs mr-1">🚫</span>}{task.title}
            </p>

            {/* Description */}
            {task.description && (
              <p className="text-xs leading-relaxed mb-2 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
                {task.description}
              </p>
            )}

            {/* Bottom row: due date + link */}
            <div className="flex items-center justify-between mt-1">
              {task.dueDate ? (
                <div className={`flex items-center gap-1 text-xs font-medium ${
                  urgency === 'overdue' ? 'text-red-500' :
                  urgency === 'today'   ? 'text-orange-500' :
                  urgency === 'soon'    ? 'text-yellow-600' : 'text-gray-400'
                }`}>
                  <Calendar size={11} />
                  <span>{formatDate(task.dueDate)}</span>
                </div>
              ) : (
                <span className="text-xs text-gray-300">
                  {task.updatedAt && task.source !== 'paste' ? (() => {
                    const days = Math.floor((Date.now() - new Date(task.updatedAt).getTime()) / 86400000);
                    return days > 0 ? `${days}d ago` : 'Today';
                  })() : ''}
                </span>
              )}

              {task.url && (
                <span role="img" aria-label="Open in source" title="Open in source">
                  <ExternalLink size={11} style={{ color: 'var(--text-secondary)' }} aria-hidden="true" />
                </span>
              )}
            </div>
            </div> {/* end task-content */}
          </div>
        </div>
      )}
    </Draggable>
  );
}
