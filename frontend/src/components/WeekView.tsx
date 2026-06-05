/**
 * @file WeekView.tsx
 * Horizontal weekly calendar strip showing Mon–Sun of the current ISO week.
 *
 * Each day column is a `Droppable` target so the user can drag a kanban task card
 * onto a day to schedule it (set its due date). Dropping on a day fires
 * `onDueDateChange` via FocusView's `handleDragEnd`.
 *
 * Two types of items appear inside a day column:
 *  - Calendar events (source: 'calendar') — fetched from Google Calendar, show time
 *  - Scheduled kanban tasks — any non-calendar task with a dueDate on that day
 *
 * The day header shows a count badge summarising how many kanban tasks are due
 * that day. The badge turns red when any of those tasks is high priority or overdue.
 */

import React, { useState } from 'react';
import { Clock, CheckCircle } from 'lucide-react';
import { Droppable } from '@hello-pangea/dnd';
import type { Task } from '../types';

interface Props {
  tasks: Task[];
  allTasks: Task[];
  selectedDay: Date | null;
  onDaySelect: (day: Date | null) => void;
  onTaskDone?: (taskId: string) => void;
}

function getWeekDays(offsetWeeks = 0): Date[] {
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7) + offsetWeeks * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

/**
 * Compare two Date objects by calendar date only, ignoring time and timezone offset.
 * Using getFullYear/Month/Date avoids the UTC-vs-local pitfall of comparing
 * toDateString() or ISO strings when the user's timezone differs from UTC.
 */
function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const SOURCE_BORDER: Record<string, string> = {
  jira:     '#3b82f6', // blue
  gmail:    '#ef4444', // red
  github:   '#6b7280', // gray
  paste:    '#8b5cf6', // violet
  calendar: '#10b981', // green
  slack:    '#a855f7', // purple
};

export function WeekView({ tasks, allTasks, selectedDay, onDaySelect, onTaskDone }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const calendarTasks = tasks.filter(t => t.source === 'calendar');
  const weekDays = getWeekDays(weekOffset);
  const today = new Date();
  const isCurrentWeek = weekOffset === 0;

  // Only non-calendar, non-Slack tasks get a due-date badge — calendar events already
  // appear as their own entries, and Slack items are shown in the inbox sidebar.
  const kanbanTasks = allTasks.filter(t => t.source !== 'calendar' && t.source !== 'slack');

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-2 px-1">
        {/* Week navigation */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setWeekOffset(w => w - 1)}
            className="p-1 rounded-lg transition-colors hover:bg-gray-100"
            style={{ color: 'var(--text-secondary)' }}
            aria-label="Previous week"
            title="Previous week"
          >
            ‹
          </button>
          <h2 className="text-sm font-semibold px-1" style={{ color: isCurrentWeek ? 'var(--accent)' : 'var(--text-secondary)' }}>
            {weekDays[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} –{' '}
            {weekDays[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: weekDays[6].getFullYear() !== today.getFullYear() ? 'numeric' : undefined })}
          </h2>
          <button
            onClick={() => setWeekOffset(w => w + 1)}
            className="p-1 rounded-lg transition-colors hover:bg-gray-100"
            style={{ color: 'var(--text-secondary)' }}
            aria-label="Next week"
            title="Next week"
          >
            ›
          </button>
        </div>

        <div className="flex items-center gap-2">
          {!isCurrentWeek && (
            <button
              onClick={() => { setWeekOffset(0); onDaySelect(null); }}
              className="text-xs px-2 py-0.5 rounded-full font-medium transition-colors"
              style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
              aria-label="Jump to current week"
              title="Jump to current week"
            >
              This week
            </button>
          )}
          {selectedDay && isCurrentWeek && (
            <button
              onClick={() => onDaySelect(null)}
              className="text-xs px-2 py-0.5 rounded-full font-medium transition-colors"
              style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
              aria-label="Clear day filter"
              title="Clear day filter"
            >
              Today
            </button>
          )}
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {calendarTasks.filter(t => {
              if (!t.dueDate) return false;
              const d = new Date(t.dueDate);
              return d >= weekDays[0] && d <= new Date(weekDays[6].getTime() + 86399999);
            }).length} events
          </span>
        </div>
      </div>

      <div className="flex gap-2 flex-1 overflow-hidden">
        {weekDays.map((day, i) => {
          const isToday = isSameDay(day, today);
          const isPast = day < today && !isToday;
          const isSelected = selectedDay !== null && isSameDay(day, selectedDay);
          const dayEvents = calendarTasks.filter(t => {
            if (!t.dueDate) return false;
            return isSameDay(new Date(t.dueDate), day);
          });

          // Count kanban tasks due this day for badge
          const dueTodayCount = kanbanTasks.filter(t => {
            if (!t.dueDate) return false;
            return isSameDay(new Date(t.dueDate), day);
          }).length;

          // Badge turns red if any due task is high priority OR is overdue (past due date).
          // This gives an at-a-glance urgency signal without opening each task.
          const hasHighPriority = kanbanTasks.some(t => {
            if (!t.dueDate) return false;
            const d = new Date(t.dueDate);
            return isSameDay(d, day) && (t.priority === 'high' || d < today);
          });

          const droppableId = `day-${toDateString(day)}`;
          const fullDayLabel = day.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' });

          let borderColor = 'var(--border)';
          if (isSelected) borderColor = '#f59e0b'; // amber accent for selected
          else if (isToday) borderColor = 'var(--accent)';

          // Each day column is a Droppable so task cards can be dragged here to
          // set their due date. The droppableId encodes the date as YYYY-MM-DD so
          // FocusView's handleDragEnd can parse it without additional lookups.
          return (
            <Droppable droppableId={droppableId} key={droppableId}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  onClick={() => onDaySelect(isSelected ? null : day)}
                  aria-label={`${fullDayLabel} — ${dueTodayCount} task${dueTodayCount !== 1 ? 's' : ''}`}
                  title="Click to filter tasks for this day. Drag a task here to schedule it for this date."
                  className={`flex flex-col flex-1 min-w-0 rounded-xl overflow-hidden cursor-pointer transition-all ${isPast ? 'opacity-60' : ''}`}
                  style={{
                    border: `2px solid ${snapshot.isDraggingOver ? '#f59e0b' : borderColor}`,
                    boxShadow: isSelected
                      ? '0 2px 12px rgba(245,158,11,0.25)'
                      : isToday
                      ? '0 2px 8px rgba(0,0,0,0.15)'
                      : 'none',
                    backgroundColor: snapshot.isDraggingOver ? 'rgba(245,158,11,0.08)' : undefined,
                  }}
                >
                  {/* Day header */}
                  <div
                    className="px-2 py-1.5 text-center relative"
                    style={{
                      backgroundColor: isSelected
                        ? '#f59e0b'
                        : isToday
                        ? 'var(--accent)'
                        : 'var(--bg-card)',
                      borderBottom: `1px solid var(--border)`,
                    }}
                  >
                    <p className="text-xs font-medium" style={{ color: (isToday || isSelected) ? '#fff' : 'var(--text-secondary)' }}>
                      {DAY_LABELS[i]}
                    </p>
                    <p className="text-lg font-bold leading-none mt-0.5" style={{ color: (isToday || isSelected) ? '#fff' : 'var(--text-primary)' }}>
                      {day.getDate()}
                    </p>
                    {/* Task count badge */}
                    {dueTodayCount > 0 && (
                      <span
                        className="absolute top-1 right-1 text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center"
                        style={{
                          backgroundColor: hasHighPriority ? '#ef4444' : '#3b82f6',
                          color: '#fff',
                          fontSize: '9px',
                        }}
                        aria-label={`${dueTodayCount} task${dueTodayCount !== 1 ? 's' : ''} due`}
                        title={`${dueTodayCount} task${dueTodayCount !== 1 ? 's' : ''} due`}
                      >
                        {dueTodayCount}
                      </span>
                    )}
                    {dueTodayCount === 0 && (
                      <span
                        className="absolute top-1 right-1 w-2 h-2 rounded-full"
                        style={{ backgroundColor: 'var(--border)' }}
                      />
                    )}
                  </div>

                  {/* Events */}
                  <div className="flex-1 overflow-y-auto p-1.5 space-y-1" style={{ backgroundColor: 'var(--bg-card)' }}>
                    {snapshot.isDraggingOver && (
                      <div
                        className="text-xs text-center py-2 rounded-lg font-medium"
                        style={{ color: '#f59e0b', border: '1px dashed #f59e0b', backgroundColor: 'rgba(245,158,11,0.05)' }}
                      >
                        Schedule here
                      </div>
                    )}
                    {(() => {
                      // Scheduled kanban tasks for this day
                      const scheduledTasks = kanbanTasks.filter(t =>
                        t.dueDate && isSameDay(new Date(t.dueDate), day) && t.status !== 'done' && t.status !== 'wontdo'
                      );
                      const allItems = [...dayEvents, ...scheduledTasks];

                      if (allItems.length === 0 && !snapshot.isDraggingOver) {
                        return (
                          <div className="h-full flex items-center justify-center">
                            <span className="text-xs" style={{ color: 'var(--border)' }}>—</span>
                          </div>
                        );
                      }

                      return allItems.map(item => {
                        const borderColor = SOURCE_BORDER[item.source] || 'var(--border)';
                        // Calendar events show a time badge; scheduled tasks show their source label.
                        const isCalendar = item.source === 'calendar';
                        const isExpanded = expandedId === item.id;
                        const cardContent = () => (
                          <div
                            className="p-1.5 rounded-lg text-xs transition-all relative"
                            onMouseEnter={() => setExpandedId(item.id)}
                            onMouseLeave={() => setExpandedId(null)}
                            style={{
                              backgroundColor: 'var(--bg-card)',
                              borderLeft: `3px solid ${borderColor}`,
                              border: `1px solid var(--border)`,
                              borderLeftWidth: '3px',
                              borderLeftColor: borderColor,
                              cursor: 'pointer',
                            }}
                          >
                            <div className="calendar-content">
                            <p
                              className="font-medium leading-tight"
                              style={{
                                color: 'var(--text-primary)',
                                ...(isExpanded
                                  ? {}
                                  : {
                                      display: '-webkit-box',
                                      WebkitBoxOrient: 'vertical',
                                      WebkitLineClamp: 2,
                                      overflow: 'hidden',
                                    }),
                              }}
                            >
                              {item.title.replace('[All Day] ', '')}
                            </p>
                            </div>
                            {item.dueDate && !isCalendar && (
                              <p className="text-xs mt-0.5" style={{ color: borderColor, opacity: 0.8 }}>
                                {item.source}
                              </p>
                            )}
                            {item.dueDate && isCalendar && !item.title.startsWith('[All Day]') && (
                              <p className="flex items-center gap-0.5 mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                                <Clock size={9} />
                                {formatTime(item.dueDate)}
                              </p>
                            )}
                            {/* Done button for scheduled tasks */}
                            {!isCalendar && onTaskDone && (
                              <button
                                onClick={e => { e.stopPropagation(); onTaskDone(item.id); }}
                                className="absolute top-1 right-1 transition-opacity"
                                style={{ opacity: isExpanded ? 1 : 0 }}
                                title="Mark as done"
                                aria-label="Mark as done"
                              >
                                <CheckCircle size={12} className="text-emerald-500" />
                              </button>
                            )}
                          </div>
                        );

                        return <div key={item.id} onClick={e => { e.stopPropagation(); item.url && window.open(item.url, '_blank'); }}>{cardContent()}</div>;
                      });
                    })()}
                    {/* @hello-pangea/dnd requires the placeholder to be rendered in the
                        droppable container to correctly calculate drop positions. Hidden
                        here because we manage layout manually with space-y-1. */}
                    <div style={{ display: 'none' }}>{provided.placeholder}</div>
                  </div>
                </div>
              )}
            </Droppable>
          );
        })}
      </div>
    </div>
  );
}
