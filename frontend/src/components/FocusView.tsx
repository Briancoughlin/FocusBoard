import React, { useState, useRef, useCallback, useEffect } from 'react';
import { DragDropContext, type DropResult } from '@hello-pangea/dnd';
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
}

const STORAGE_KEY = 'focusboard-split-percent';
const DEFAULT_SPLIT = 35;
const MIN_SPLIT = 15;
const MAX_SPLIT = 70;

export function FocusView({ tasks, kanbanTasks, isLoading, onTaskMove, onDismiss, onAddToBoard }: Props) {
  const [splitPercent, setSplitPercent] = useState<number>(DEFAULT_SPLIT);

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
    onTaskMove(result.draggableId, result.destination.droppableId as Status);
  }, [onTaskMove]);

  const endOfWeek = new Date();
  endOfWeek.setDate(endOfWeek.getDate() + (7 - endOfWeek.getDay()));
  endOfWeek.setHours(23, 59, 59, 999);

  const weekTasks = kanbanTasks.filter(t => {
    if (t.dueDate) return new Date(t.dueDate) <= endOfWeek;
    return t.source === 'jira' && t.priority === 'high';
  });


  return (
    <div className="flex h-full overflow-hidden gap-0">
    <div ref={containerRef} className="flex flex-col flex-1 min-w-0 overflow-hidden">
      {/* Calendar pane */}
      <div style={{ height: `${splitPercent}%` }} className="overflow-hidden pb-1">
        <WeekView tasks={tasks} />
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
      <div style={{ height: `${100 - splitPercent}%` }} className="overflow-hidden pt-1">
        <DragDropContext onDragEnd={handleDragEnd}>
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
        </DragDropContext>
      </div>
    </div>
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
