import React from 'react';
import { Clock } from 'lucide-react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import type { Task } from '../types';

interface Props {
  tasks: Task[];
  allTasks: Task[];
  selectedDay: Date | null;
  onDaySelect: (day: Date | null) => void;
}

function getWeekDays(): Date[] {
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

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

export function WeekView({ tasks, allTasks, selectedDay, onDaySelect }: Props) {
  const calendarTasks = tasks.filter(t => t.source === 'calendar');
  const weekDays = getWeekDays();
  const today = new Date();

  // Count kanban tasks due on each day for the badge
  const kanbanTasks = allTasks.filter(t => t.source !== 'calendar' && t.source !== 'slack');

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-2 px-1">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
          Week of {weekDays[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} –{' '}
          {weekDays[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </h2>
        <div className="flex items-center gap-2">
          {selectedDay && (
            <button
              onClick={() => onDaySelect(null)}
              className="text-xs px-2 py-0.5 rounded-full font-medium transition-colors"
              style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
              aria-label="Reset to current week view"
              title="Reset to current week view"
            >
              Today
            </button>
          )}
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{calendarTasks.length} events this week</span>
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
                        t.dueDate && isSameDay(new Date(t.dueDate), day)
                      );
                      const allItems = [...dayEvents, ...scheduledTasks];

                      if (allItems.length === 0 && !snapshot.isDraggingOver) {
                        return (
                          <div className="h-full flex items-center justify-center">
                            <span className="text-xs" style={{ color: 'var(--border)' }}>—</span>
                          </div>
                        );
                      }

                      let draggableIndex = 0;
                      return allItems.map(item => {
                        const borderColor = SOURCE_BORDER[item.source] || 'var(--border)';
                        const isCalendar = item.source === 'calendar';
                        const cardContent = (dragHandleProps?: object, draggableStyle?: object) => (
                          <div
                            onClick={e => { e.stopPropagation(); item.url && window.open(item.url, '_blank'); }}
                            role="button"
                            aria-label={item.title.replace('[All Day] ', '')}
                            title={item.title}
                            tabIndex={0}
                            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); item.url && window.open(item.url, '_blank'); } }}
                            className="p-1.5 rounded-lg text-xs transition-all"
                            style={{
                              backgroundColor: 'var(--bg-card)',
                              borderLeft: `3px solid ${borderColor}`,
                              border: `1px solid var(--border)`,
                              borderLeftWidth: '3px',
                              borderLeftColor: borderColor,
                              cursor: isCalendar ? 'pointer' : 'grab',
                              ...draggableStyle,
                            }}
                            {...dragHandleProps}
                          >
                            <p className="font-medium line-clamp-2 leading-tight" style={{ color: 'var(--text-primary)' }}>
                              {item.title.replace('[All Day] ', '')}
                            </p>
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
                          </div>
                        );

                        // Calendar events are not draggable, task cards are
                        if (isCalendar) {
                          return <div key={item.id}>{cardContent()}</div>;
                        }
                        const idx = draggableIndex++;
                        return (
                          <Draggable key={item.id} draggableId={item.id} index={idx}>
                            {(dragProvided) => (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                              >
                                {cardContent(dragProvided.dragHandleProps || {}, dragProvided.draggableProps.style)}
                              </div>
                            )}
                          </Draggable>
                        );
                      });
                    })()}
                    {/* Hidden placeholder — keeps droppable working even with no children */}
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
