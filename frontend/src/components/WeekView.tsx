import React from 'react';
import { Clock } from 'lucide-react';
import type { Task } from '../types';

interface Props {
  tasks: Task[];
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

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function WeekView({ tasks }: Props) {
  const calendarTasks = tasks.filter(t => t.source === 'calendar');
  const weekDays = getWeekDays();
  const today = new Date();

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-2 px-1">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
          Week of {weekDays[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} –{' '}
          {weekDays[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </h2>
        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{calendarTasks.length} events this week</span>
      </div>

      <div className="flex gap-2 flex-1 overflow-hidden">
        {weekDays.map((day, i) => {
          const isToday = isSameDay(day, today);
          const isPast = day < today && !isToday;
          const dayEvents = calendarTasks.filter(t => {
            if (!t.dueDate) return false;
            return isSameDay(new Date(t.dueDate), day);
          });

          return (
            <div
              key={i}
              className={`flex flex-col flex-1 min-w-0 rounded-xl overflow-hidden ${isPast ? 'opacity-50' : ''}`}
              style={{ border: `1px solid ${isToday ? 'var(--accent)' : 'var(--border)'}`, boxShadow: isToday ? '0 2px 8px rgba(0,0,0,0.15)' : 'none' }}
            >
              {/* Day header */}
              <div
                className="px-2 py-1.5 text-center"
                style={{ backgroundColor: isToday ? 'var(--accent)' : 'var(--bg-card)', borderBottom: `1px solid var(--border)` }}
              >
                <p className="text-xs font-medium" style={{ color: isToday ? '#fff' : 'var(--text-secondary)' }}>
                  {DAY_LABELS[i]}
                </p>
                <p className="text-lg font-bold leading-none mt-0.5" style={{ color: isToday ? '#fff' : 'var(--text-primary)' }}>
                  {day.getDate()}
                </p>
              </div>

              {/* Events */}
              <div className="flex-1 overflow-y-auto p-1.5 space-y-1" style={{ backgroundColor: 'var(--bg-card)' }}>
                {dayEvents.length === 0 ? (
                  <div className="h-full flex items-center justify-center">
                    <span className="text-xs" style={{ color: 'var(--border)' }}>—</span>
                  </div>
                ) : (
                  dayEvents.map(event => (
                    <div
                      key={event.id}
                      onClick={() => event.url && window.open(event.url, '_blank')}
                      className="p-1.5 rounded-lg text-xs cursor-pointer transition-all"
                      style={{
                        backgroundColor: isToday ? 'var(--accent-light)' : 'var(--bg)',
                        border: `1px solid var(--border)`,
                      }}
                    >
                      <p className="font-medium line-clamp-2 leading-tight" style={{ color: 'var(--text-primary)' }}>
                        {event.title.replace('[All Day] ', '')}
                      </p>
                      {event.dueDate && !event.title.startsWith('[All Day]') && (
                        <p className="flex items-center gap-0.5 mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                          <Clock size={9} />
                          {formatTime(event.dueDate)}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
