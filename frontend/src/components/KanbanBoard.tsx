import React, { useCallback, useState } from 'react';
import { DragDropContext, type DropResult } from '@hello-pangea/dnd';
import type { Task, Status, Source } from '../types';
import { KanbanColumn, COLUMNS } from './KanbanColumn';
import { Settings } from 'lucide-react';

interface Props {
  tasks: Task[];
  isLoading: boolean;
  onTaskMove: (taskId: string, newStatus: Status) => void;
  onOpenSettings: () => void;
  onDismiss: (taskId: string) => void;
  errors: Array<{ source: string; error: string }>;
}

const UNCONFIGURED_ERRORS = ['not configured'];

type FilterTab = 'all' | 'week' | Source; // Source already includes 'paste'

const TABS: { id: FilterTab; label: string; color: string; activeColor: string }[] = [
  { id: 'all',      label: 'All',        color: 'text-gray-500 border-transparent',  activeColor: 'text-gray-900 border-gray-900' },
  { id: 'week',     label: 'This Week',  color: 'text-rose-400 border-transparent',  activeColor: 'text-rose-600 border-rose-600' },
  { id: 'jira',     label: 'Jira',       color: 'text-blue-400 border-transparent',  activeColor: 'text-blue-600 border-blue-600' },
  { id: 'gmail',    label: 'Gmail',      color: 'text-red-400 border-transparent',   activeColor: 'text-red-600 border-red-600' },
  { id: 'calendar', label: 'Calendar',   color: 'text-green-400 border-transparent', activeColor: 'text-green-600 border-green-600' },
  { id: 'slack',    label: 'Slack',      color: 'text-purple-400 border-transparent',activeColor: 'text-purple-600 border-purple-600' },
  { id: 'paste',    label: 'Zoom/Notes', color: 'text-violet-400 border-transparent',activeColor: 'text-violet-600 border-violet-600' },
];

function isThisWeek(task: Task): boolean {
  const endOfWeek = new Date();
  endOfWeek.setDate(endOfWeek.getDate() + (7 - endOfWeek.getDay()));
  endOfWeek.setHours(23, 59, 59, 999);

  if (task.dueDate) {
    return new Date(task.dueDate) <= endOfWeek;
  }
  // High priority Jira tickets count even without a due date
  return task.source === 'jira' && task.priority === 'high';
}

export function KanbanBoard({ tasks, isLoading, onTaskMove, onOpenSettings, onDismiss, errors }: Props) {
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  const handleDragEnd = useCallback(
    (result: DropResult) => {
      if (!result.destination) return;
      const { draggableId, destination } = result;
      const newStatus = destination.droppableId as Status;
      onTaskMove(draggableId, newStatus);
    },
    [onTaskMove]
  );

  const unconfiguredSources = errors
    .filter(e => UNCONFIGURED_ERRORS.some(msg => e.error.toLowerCase().includes(msg)))
    .map(e => e.source);

  const realErrors = errors.filter(
    e => !UNCONFIGURED_ERRORS.some(msg => e.error.toLowerCase().includes(msg))
  );

  const filteredTasks = activeTab === 'all' ? tasks
    : activeTab === 'week' ? tasks.filter(isThisWeek)
    : tasks.filter(t => t.source === activeTab);

  return (
    <div className="flex flex-col h-full">
      {/* Banners */}
      {unconfiguredSources.length > 0 && (
        <div className="mb-3 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between text-sm text-blue-700">
          <span><strong>{unconfiguredSources.join(', ')}</strong> not connected.</span>
          <button
            onClick={onOpenSettings}
            className="flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium underline"
          >
            <Settings size={14} />
            Configure in Settings
          </button>
        </div>
      )}
      {realErrors.map(e => (
        <div key={e.source} className="mb-2 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <strong>{e.source}:</strong> {e.error}
        </div>
      ))}

      {/* Source tabs */}
      <div className="flex gap-1 mb-4 border-b border-gray-200">
        {TABS.map(tab => {
          const count = tab.id === 'all' ? tasks.length
            : tab.id === 'week' ? tasks.filter(isThisWeek).length
            : tasks.filter(t => t.source === tab.id).length;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${isActive ? tab.activeColor : tab.color + ' hover:text-gray-700'}`}
            >
              {tab.label}
              {count > 0 && (
                <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${isActive ? 'bg-gray-100' : 'bg-gray-100'}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Board */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-4 flex-1 overflow-x-auto pb-4">
          {COLUMNS.map(col => (
            <KanbanColumn
              key={col.id}
              column={col}
              tasks={filteredTasks.filter(t => t.status === col.id)}
              isLoading={isLoading}
              onDismiss={onDismiss}
            />
          ))}
        </div>
      </DragDropContext>
    </div>
  );
}
