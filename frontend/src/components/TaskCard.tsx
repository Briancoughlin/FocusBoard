import React from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { ExternalLink, Calendar, Flame, X } from 'lucide-react';
import type { Task } from '../types';
import { SourceBadge } from './SourceBadge';

interface Props {
  task: Task;
  index: number;
  onDismiss: (taskId: string) => void;
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

export function TaskCard({ task, index, onDismiss }: Props) {
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
          className={`
            bg-white rounded-lg border border-gray-200 mb-2 cursor-grab active:cursor-grabbing
            shadow-sm hover:shadow-md transition-all duration-150 overflow-hidden
            ${task.url ? 'hover:border-blue-300' : ''}
            ${snapshot.isDragging ? 'shadow-lg rotate-1 border-blue-300 ring-2 ring-blue-200' : ''}
          `}
        >
          {/* Urgency colour strip */}
          <div className={`h-1 w-full ${bar}`} />

          <div className="p-3">
            {/* Top row: source badge + urgency badge + dismiss */}
            <div className="flex items-center justify-between mb-2">
              <SourceBadge source={task.source} />
              <div className="flex items-center gap-1">
              {badge && (
                <span className={`flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                  urgency === 'overdue' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'
                }`}>
                  <Flame size={10} />
                  {badge}
                </span>
              )}
              {task.priority && task.source === 'jira' && (
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                  task.priority === 'high'   ? 'bg-red-100 text-red-600' :
                  task.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                               'bg-gray-100 text-gray-500'
                }`}>
                  {task.priority === 'high' ? 'High' : task.priority === 'medium' ? 'Med' : 'Low'}
                </span>
              )}
              <button
                onClick={e => { e.stopPropagation(); onDismiss(task.id); }}
                className="text-gray-300 hover:text-gray-500 transition-colors p-0.5 rounded"
                title="Dismiss"
              >
                <X size={12} />
              </button>
              </div>
            </div>

            {/* Ticket key */}
            {task.ticketKey && (
              <p className="text-xs font-mono text-blue-400 mb-0.5">{task.ticketKey}</p>
            )}

            {/* Title — click to open */}
            <p
              onClick={e => { e.stopPropagation(); if (task.url) window.open(task.url, '_blank'); }}
              className={`text-sm font-semibold text-gray-800 leading-snug mb-1 line-clamp-2 ${task.url ? 'hover:text-blue-600 cursor-pointer' : ''}`}
            >
              {task.title}
            </p>

            {/* Description */}
            {task.description && (
              <p className="text-xs text-gray-500 leading-relaxed mb-2 line-clamp-2">
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
                  {task.updatedAt ? `${Math.floor((Date.now() - new Date(task.updatedAt).getTime()) / 86400000)}d ago` : ''}
                </span>
              )}

              {task.url && (
                <ExternalLink size={11} className="text-gray-300" />
              )}
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
}
