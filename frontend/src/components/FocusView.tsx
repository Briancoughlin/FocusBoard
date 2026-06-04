/**
 * @file FocusView.tsx
 * The primary working view — a vertically split pane with:
 *   - Top: WeekView calendar strip (resizable)
 *   - Bottom: Kanban columns filtered to the current week's relevant tasks
 *   - Right: InboxSidebar showing Slack/Gmail items
 *
 * The split ratio is persisted and restored across sessions. The pane divider uses
 * the Pointer Capture API for reliable dragging that works even when the cursor
 * briefly leaves the handle element.
 *
 * DragDropContext wraps both the calendar and the kanban so a single drag gesture
 * can target either a day column (schedules the task) or a status column (moves it).
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { DragDropContext, type DropResult } from '@hello-pangea/dnd';
import { X } from 'lucide-react';
import type { Task, Status } from '../types';
import { WeekView } from './WeekView';
import { KanbanColumn, COLUMNS } from './KanbanColumn';
import { InboxSidebar } from './InboxSidebar';
import { getPersistedValue, setPersistedValue } from '../services/persistence';
import { logAction } from '../services/actionLog';

interface Props {
  tasks: Task[];
  kanbanTasks: Task[];
  isLoading: boolean;
  onTaskMove: (taskId: string, newStatus: Status) => void;
  onDismiss: (taskId: string) => void;
  onAddToBoard: (task: Task) => void;
  onDueDateChange: (taskId: string, dateString: string) => void;
  onPin: (taskId: string) => void;
  pinnedIds: Set<string>;
  onEpicChange?: (epicKey: string) => void;
  onWontDo?: (taskId: string) => void;
}

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

export function FocusView({ tasks, kanbanTasks, isLoading, onTaskMove, onDismiss, onAddToBoard, onDueDateChange, onPin, pinnedIds, onEpicChange, onWontDo }: Props) {
  const [splitPercent, setSplitPercent] = useState<number>(DEFAULT_SPLIT);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  useEffect(() => {
    getPersistedValue<number>('split-percent', DEFAULT_SPLIT).then(val => {
      setSplitPercent(val);
    });
  }, []);

  const containerRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);

  /**
   * Begin a resize drag on the split handle.
   *
   * Pointer capture (`setPointerCapture`) is used instead of document-level
   * mousemove listeners. This means all pointer events continue routing to the
   * handle element even when the cursor moves outside it, so fast drags don't
   * lose tracking. The capture is released on pointerup.
   *
   * The final split position is persisted only on drag end (not on every move)
   * to avoid hammering the persistence API.
   */
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
      // Use functional updater to read the latest value without a closure dependency
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

  // --- Base week task set ---
  // Determines which tasks appear in the kanban columns. The intent is to show
  // only what's relevant to this week, avoiding an overwhelming full backlog view.
  //
  // Inclusion rules (any one is sufficient):
  //   - Pinned by the user → always visible regardless of due date or source
  //   - Source is 'paste' (quick-add) → always visible; user explicitly added it
  //   - Has a due date within this week (today through Sunday) → scheduled work
  //   - Jira ticket with high priority and no due date → urgent backlog item
  //
  // wontdo tasks are excluded entirely — they clutter the schedule view.
  const baseWeekTasks = kanbanTasks
    .filter(t => t.status !== 'wontdo')
    .filter(t => {
      if (pinnedIds.has(t.id)) return true;
      if (t.source === 'paste') return true;
      if (t.dueDate) return new Date(t.dueDate) <= endOfWeek;
      return t.source === 'jira' && t.priority === 'high';
    })
    .filter(t => selectedEpic === 'all' || t.epicKey === selectedEpic);

  // When a specific calendar day is selected, narrow the kanban to tasks that
  // are due that day OR are undated high-priority Jira tickets (always urgent).
  const weekTasks = selectedDay
    ? baseWeekTasks.filter(t => {
        if (t.dueDate && isSameDay(new Date(t.dueDate), selectedDay)) return true;
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
          onDaySelect={(day) => { if (day) logAction('Calendar day selected'); setSelectedDay(day); }}
          onTaskDone={taskId => onTaskMove(taskId, 'done')}
        />
      </div>

      {/* Drag handle */}
      <div
        ref={handleRef}
        onPointerDown={handlePointerDown}
        className="flex-shrink-0 h-4 flex items-center justify-center cursor-row-resize group z-10 select-none"
        role="separator"
        aria-orientation="horizontal"
        aria-label="Drag to resize calendar and task panels"
        title="Drag to resize calendar and task panels"
        tabIndex={0}
      >
        <div className="w-20 h-1.5 rounded-full bg-gray-300 group-hover:bg-blue-400 transition-colors" />
      </div>

      {/* Kanban pane */}
      <div style={{ height: `${100 - splitPercent}%` }} className="overflow-hidden pt-1 flex flex-col">
          {/* Day filter banner — shown when the user has clicked a calendar day.
            Reminds them that the kanban is filtered and provides a dismiss button. */}
        {selectedDay && (
          <div
            className="flex items-center justify-between px-3 py-1.5 mb-2 rounded-lg text-sm font-medium flex-shrink-0"
            style={{ backgroundColor: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.4)', color: '#b45309' }}
            title="Showing tasks filtered by this day"
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
            <span className="text-xs text-gray-400 font-medium" title="Filter the kanban to show only tasks from a specific epic">Epic:</span>
            <select
              value={selectedEpic}
              onChange={e => { logAction('Epic filter changed'); setSelectedEpic(e.target.value); onEpicChange?.(e.target.value); }}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 max-w-xs"
              aria-label="Filter by epic"
              title="Filter the kanban to show only tasks from a specific epic"
            >
              <option value="all">All epics</option>
              {epics.map(e => (
                <option key={e.key} value={e.key}>{e.key} — {e.name}</option>
              ))}
            </select>
            {selectedEpic !== 'all' && (
              <button
                onClick={() => { setSelectedEpic('all'); onEpicChange?.('all'); }}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Clear epic filter"
                title="Show all epics"
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
              tasks={col.id === 'done'
                ? [...weekTasks.filter(t => t.status === 'done'), ...kanbanTasks.filter(t => t.status === 'wontdo')]
                : weekTasks.filter(t => t.status === col.id)}
              isLoading={isLoading}
              onDismiss={onDismiss}
              onPin={onPin}
              pinnedIds={pinnedIds}
              onWontDo={onWontDo}
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
