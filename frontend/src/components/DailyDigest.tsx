import React from 'react';
import { X, AlertTriangle, Flame, CalendarDays, CheckSquare } from 'lucide-react';
import type { Task } from '../types';

interface Props {
  tasks: Task[];
  onDismiss: () => void;
}

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
}

function isOverdue(dateStr: string): boolean {
  const d = new Date(dateStr);
  d.setHours(23, 59, 59, 999);
  return d < new Date();
}

function greet(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function DailyDigest({ tasks, onDismiss }: Props) {
  const activeTasks = tasks.filter(t => t.status !== 'done');
  const overdue = activeTasks.filter(t => t.dueDate && isOverdue(t.dueDate));
  const dueToday = activeTasks.filter(t => t.dueDate && isToday(t.dueDate) && !isOverdue(t.dueDate));
  const meetingsToday = activeTasks.filter(t => t.source === 'calendar' && t.dueDate && isToday(t.dueDate));
  const highPriority = activeTasks.filter(t => t.priority === 'high' && !t.dueDate);

  const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-5 text-white">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-blue-100 text-sm font-medium">{dayName}</p>
              <h2 className="text-2xl font-bold mt-0.5">{greet()} Brian</h2>
              <p className="text-blue-100 text-sm mt-1">Here's what needs your attention today</p>
            </div>
            <button onClick={onDismiss} className="text-white/70 hover:text-white transition-colors mt-1">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="p-5 space-y-3">
          {overdue.length > 0 && (
            <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-xl">
              <div className="bg-red-100 p-2 rounded-lg">
                <AlertTriangle size={18} className="text-red-500" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-red-700">{overdue.length} overdue {overdue.length === 1 ? 'item' : 'items'}</p>
                <p className="text-xs text-red-500 mt-0.5 line-clamp-1">
                  {overdue.slice(0, 2).map(t => t.title).join(', ')}{overdue.length > 2 ? ` +${overdue.length - 2} more` : ''}
                </p>
              </div>
            </div>
          )}

          {dueToday.length > 0 && (
            <div className="flex items-center gap-3 p-3 bg-orange-50 border border-orange-200 rounded-xl">
              <div className="bg-orange-100 p-2 rounded-lg">
                <Flame size={18} className="text-orange-500" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-orange-700">{dueToday.length} due today</p>
                <p className="text-xs text-orange-500 mt-0.5 line-clamp-1">
                  {dueToday.slice(0, 2).map(t => t.title).join(', ')}{dueToday.length > 2 ? ` +${dueToday.length - 2} more` : ''}
                </p>
              </div>
            </div>
          )}

          {meetingsToday.length > 0 && (
            <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl">
              <div className="bg-green-100 p-2 rounded-lg">
                <CalendarDays size={18} className="text-green-600" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-green-700">{meetingsToday.length} {meetingsToday.length === 1 ? 'meeting' : 'meetings'} today</p>
                <p className="text-xs text-green-600 mt-0.5 line-clamp-1">
                  {meetingsToday.slice(0, 2).map(t => t.title).join(', ')}{meetingsToday.length > 2 ? ` +${meetingsToday.length - 2} more` : ''}
                </p>
              </div>
            </div>
          )}

          {highPriority.length > 0 && (
            <div className="flex items-center gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-xl">
              <div className="bg-yellow-100 p-2 rounded-lg">
                <CheckSquare size={18} className="text-yellow-600" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-yellow-700">{highPriority.length} high priority {highPriority.length === 1 ? 'task' : 'tasks'}</p>
                <p className="text-xs text-yellow-600 mt-0.5 line-clamp-1">
                  {highPriority.slice(0, 2).map(t => t.title).join(', ')}{highPriority.length > 2 ? ` +${highPriority.length - 2} more` : ''}
                </p>
              </div>
            </div>
          )}

          {overdue.length === 0 && dueToday.length === 0 && meetingsToday.length === 0 && highPriority.length === 0 && (
            <div className="text-center py-4">
              <p className="text-2xl mb-2">🎉</p>
              <p className="font-semibold text-gray-700">You're all clear!</p>
              <p className="text-sm text-gray-400 mt-1">Nothing urgent today. Great work.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-3">
            <span>{activeTasks.length} total active tasks</span>
            <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <button
            onClick={onDismiss}
            className="w-full py-2.5 bg-gray-900 hover:bg-gray-700 text-white font-medium rounded-xl transition-colors text-sm"
          >
            Let's go
          </button>
        </div>
      </div>
    </div>
  );
}
