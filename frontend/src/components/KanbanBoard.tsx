import React, { useCallback, useState } from 'react';
import { DragDropContext, type DropResult } from '@hello-pangea/dnd';
import type { Task, Status, Source } from '../types';
import { KanbanColumn, COLUMNS } from './KanbanColumn';
import { Settings } from 'lucide-react';
import { logAction } from '../services/actionLog';

interface Props {
  tasks: Task[];
  isLoading: boolean;
  isSyncing?: boolean;
  onTaskMove: (taskId: string, newStatus: Status) => void;
  onOpenSettings: () => void;
  onDismiss: (taskId: string) => void;
  onPin: (taskId: string) => void;
  pinnedIds: Set<string>;
  onWontDo: (taskId: string) => void;
  errors: Array<{ source: string; error: string }>;
}

const UNCONFIGURED_ERRORS = ['not configured'];

type FilterTab = 'all' | 'week' | Source; // Source already includes 'paste'

const TABS: { id: FilterTab; label: string; color: string; activeColor: string; tooltip: string }[] = [
  { id: 'all',      label: 'All',        color: 'text-gray-500 border-transparent',  activeColor: 'text-gray-900 border-gray-900', tooltip: 'Show all tasks' },
  { id: 'jira',     label: 'Jira',       color: 'text-blue-400 border-transparent',  activeColor: 'text-blue-600 border-blue-600', tooltip: 'Show Jira tickets only' },
  { id: 'gmail',    label: 'Gmail',      color: 'text-red-400 border-transparent',   activeColor: 'text-red-600 border-red-600', tooltip: 'Show Gmail action items only' },
  { id: 'paste',    label: 'Zoom/Notes', color: 'text-violet-400 border-transparent', activeColor: 'text-violet-600 border-violet-600', tooltip: 'Show Quick Add and Zoom notes only' },
  { id: 'github',   label: 'GitHub',     color: 'text-gray-400 border-transparent',   activeColor: 'text-gray-700 border-gray-700', tooltip: 'Show GitHub PRs and notifications only' },
];


export function KanbanBoard({ tasks, isLoading, isSyncing, onTaskMove, onOpenSettings, onDismiss, onPin, pinnedIds, onWontDo, errors }: Props) {
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
    : tasks.filter(t => t.source === activeTab);

  return (
    <div className="flex flex-col h-full relative">
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
      <div className="flex gap-1 mb-4 border-b" style={{ borderColor: 'var(--border)' }} role="tablist" aria-label="Filter tasks by source">
        {TABS.map(tab => {
          const count = tab.id === 'all' ? tasks.length
            : tasks.filter(t => t.source === tab.id).length;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => { logAction(`Backlog filter: ${tab.label}`); setActiveTab(tab.id); }}
              role="tab"
              aria-selected={isActive}
              aria-label={tab.id === 'all' ? `Show all tasks (${count})` : `Show ${count} tasks from ${tab.label}`}
              title={tab.tooltip}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${isActive ? 'border-[var(--accent)] text-[var(--text-primary)]' : tab.color + ' hover:text-gray-700'}`}
              style={isActive ? { borderBottomColor: 'var(--accent)', color: 'var(--text-primary)' } : {}}
            >
              {tab.label}
              {count > 0 && (
                <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${isActive ? 'bg-gray-100' : 'bg-gray-100'}`} aria-hidden="true">
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
              tasks={col.id === 'done'
                ? [...filteredTasks.filter(t => t.status === 'done'), ...tasks.filter(t => t.status === 'wontdo')]
                : filteredTasks.filter(t => t.status === col.id)}
              isLoading={isLoading}
              onDismiss={onDismiss}
              onPin={onPin}
              pinnedIds={pinnedIds}
              onWontDo={onWontDo}
            />
          ))}
        </div>
      </DragDropContext>
      {isSyncing && (
        <div
          className="absolute inset-0 pointer-events-none transition-opacity duration-300"
          style={{ backgroundColor: 'rgba(0,0,0,0.03)' }}
        />
      )}
    </div>
  );
}
