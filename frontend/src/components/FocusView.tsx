import React, { useState, useRef, useCallback, useEffect } from 'react';
import { DragDropContext, type DropResult } from '@hello-pangea/dnd';
import { X } from 'lucide-react';
import type { Task, Status } from '../types';
import { WeekView } from './WeekView';
import { KanbanColumn, COLUMNS } from './KanbanColumn';
import { getUrgencyScore } from './TaskCard';
import { InboxSidebar } from './InboxSidebar';
import { getPersistedValue, setPersistedValue } from '../services/persistence';

interface Props {
  tasks: Task[];
  kanbanTasks: Task[];
  isLoading: boolean;
  onTaskMove: (taskId: string, newStatus: Status) => void;
  onDismiss: (taskId: string) => void;
  onAddToBoard: (task: Task) => void;
  onDueDateChange: (taskId: string, dateString: string) => void;
}

const STORAGE_KEY = 'focusboard-split-percent';
const DEFAULT_SPLIT = 35;
const MIN_SPLIT = 15;
const MAX_SPLIT = 70;

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function formatDayLabel(day: Date): string {
  return day.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function FocusView({ tasks, kanbanTasks, isLoading, onTaskMove, onDismiss, onAddToBoard, onDueDateChange }: Props) {
  const [splitPercent, setSplitPercent] = useState<number>(DEFAULT_SPLIT);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  useEffect(() => {
    getPersistedValue<number>('split-percent', DEFAULT_SPLIT).then(val => {
      setSplitPercent(val);
    });
  }, []);

  const containerRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    const handle = handleRef.current;
    const container = containerRef.current;
    if (!handle || !container) return;
    handle.setPointerCapture(e.pointerId);

    const onPointerMove = (ev: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      const pct = ((ev.clientY - rect.top) / rect.height) * 100;
      setSplitPercent(Math.min(MAX_SPLIT, Math.max(MIN_SPLIT, pct)));
    };

    const onPointerUp = (ev: PointerEvent) => {
      handle.releasePointerCapture(ev.pointerId);
      handle.removeEventListener('pointermove', onPointerMove);
      handle.removeEventListener('pointerup', onPointerUp);
      setSplitPercent(prev => {
        setPersistedValue('split-percent', prev);
        return prev;
      });
    };

    handle.addEventListener('pointermove', onPointerMove);
    handle.addEventListener('pointerup', onPointerUp);
  }, []);

  const handleDragEnd = useCallback((result: DropResult) => {
    if (!result.destination) return;

    const dest = result.destination.droppableId;

    if (dest.startsWith('day-')) {
      // Dropped onto a calendar day — schedule the task
      const dateString = dest.replace('day-', ''); // YYYY-MM-DD
      onDueDateChange(result.draggableId, dateString);
    } else {
      // Dropped onto a kanban column — update status
      onTaskMove(result.draggableId, dest as Status);
    }
  }, [onTaskMove, onDueDateChange]);

  const [selectedEpic, setSelectedEpic] = useState<string>('all');

  const endOfWeek = new Date();
  endOfWeek.setDate(endOfWeek.getDate() + (7 - endOfWeek.getDay()));
  endOfWeek.setHours(23, 59, 59, 999);

  // Build epic list from Jira tasks
  const epics = Array.from(
    new Map(
      kanbanTasks
        .filter(t => t.epicKey)
        .map(t => [t.epicKey!, { key: t.epicKey!, name: t.epicName || t.epicKey! }])
    ).values()
  ).sort((a, b) => a.name.localeCompare(b.name));

  // Base week tasks (unfiltered by day)
  const baseWeekTasks = kanbanTasks
    .filter(t => {
      if (t.dueDate) return new Date(t.dueDate) <= endOfWeek;
      return t.source === 'jira' && t.priority === 'high';
    })
    .filter(t => selectedEpic === 'all' || t.epicKey === selectedEpic);

  // Apply day filter
  const weekTasks = selectedDay
    ? baseWeekTasks.filter(t => {
        if (t.dueDate && isSameDay(new Date(t.dueDate), selectedDay)) return true;
        // Always show high priority Jira with no due date
        if (!t.dueDate && t.source === 'jira' && t.priority === 'high') return true;
        return false;
      })
    : baseWeekTasks;

  return (
    <div className="flex h-full overflow-hidden gap-0" style={{ backgroundColor: 'var(--bg)' }}>
    <DragDropContext onDragEnd={handleDragEnd}>
    <div ref={containerRef} className="flex flex-col flex-1 min-w-0 overflow-hidden">
      {/* Calendar pane */}
      <div style={{ height: `${splitPercent}%` }} className="overflow-hidden pb-1">
        <WeekView
          tasks={tasks}
          allTasks={kanbanTasks}
          selectedDay={selectedDay}
          onDaySelect={setSelectedDay}
        />
      </div>

      {/* Drag handle */}
      <div
        ref={handleRef}
        onPointerDown={handlePointerDown}
        className="flex-shrink-0 h-4 flex items-center justify-center cursor-row-resize group z-10 select-none"
      >
        <div className="w-20 h-1.5 rounded-full bg-gray-300 group-hover:bg-blue-400 transition-colors" />
      </div>

      {/* Kanban pane */}
      <div style={{ height: `${100 - splitPercent}%` }} className="overflow-hidden pt-1 flex flex-col">
        {/* Day filter banner */}
        {selectedDay && (
          <div
            className="flex items-center justify-between px-3 py-1.5 mb-2 rounded-lg text-sm font-medium flex-shrink-0"
            style={{ backgroundColor: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.4)', color: '#b45309' }}
          >
            <span>Showing tasks for {formatDayLabel(selectedDay)}</span>
            <button
              onClick={() => setSelectedDay(null)}
              className="ml-2 hover:opacity-70 transition-opacity"
              aria-label="Clear day filter"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Epic filter */}
        {epics.length > 0 && (
          <div className="flex items-center gap-2 px-1 pb-2 flex-shrink-0">
            <span className="text-xs text-gray-400 font-medium">Epic:</span>
            <select
              value={selectedEpic}
              onChange={e => setSelectedEpic(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 max-w-xs"
            >
              <option value="all">All epics</option>
              {epics.map(e => (
                <option key={e.key} value={e.key}>{e.key} — {e.name}</option>
              ))}
            </select>
            {selectedEpic !== 'all' && (
              <button
                onClick={() => setSelectedEpic('all')}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                ✕ Clear
              </button>
            )}
          </div>
        )}
        <div className="flex gap-4 h-full overflow-x-auto pb-2">
          {COLUMNS.map(col => (
            <KanbanColumn
              key={col.id}
              column={col}
              tasks={weekTasks.filter(t => t.status === col.id)}
              isLoading={isLoading}
              onDismiss={onDismiss}
            />
          ))}
        </div>
      </div>
    </div>
    </DragDropContext>
    <InboxSidebar
      tasks={tasks}
      onAddToBoard={item => {
        const task = tasks.find(t => t.id === item.id);
        if (task) onAddToBoard(task);
      }}
    />
    </div>
  );
}
