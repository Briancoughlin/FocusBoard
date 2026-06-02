import React from 'react';
import { Droppable } from '@hello-pangea/dnd';
import type { Task, Status } from '../types';
import { TaskCard, getUrgencyScore } from './TaskCard';

interface ColumnConfig {
  id: Status;
  label: string;
  headerColor: string;
  countColor: string;
  borderColor: string;
  bgColor: string;
}

export const COLUMNS: ColumnConfig[] = [
  {
    id: 'todo',
    label: 'To Do',
    headerColor: 'text-blue-700',
    countColor: 'bg-blue-100 text-blue-700',
    borderColor: 'border-t-blue-500',
    bgColor: 'bg-blue-50',
  },
  {
    id: 'inprogress',
    label: 'In Progress',
    headerColor: 'text-amber-700',
    countColor: 'bg-amber-100 text-amber-700',
    borderColor: 'border-t-amber-500',
    bgColor: 'bg-amber-50',
  },
  {
    id: 'waiting',
    label: 'Waiting',
    headerColor: 'text-purple-700',
    countColor: 'bg-purple-100 text-purple-700',
    borderColor: 'border-t-purple-500',
    bgColor: 'bg-purple-50',
  },
  {
    id: 'done',
    label: 'Done',
    headerColor: 'text-emerald-700',
    countColor: 'bg-emerald-100 text-emerald-700',
    borderColor: 'border-t-emerald-500',
    bgColor: 'bg-emerald-50',
  },
];

interface Props {
  column: ColumnConfig;
  tasks: Task[];
  isLoading?: boolean;
  onDismiss: (taskId: string) => void;
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3 mb-2 animate-pulse">
      <div className="flex justify-between mb-2">
        <div className="h-4 w-14 bg-gray-200 rounded" />
        <div className="h-2 w-2 bg-gray-200 rounded-full" />
      </div>
      <div className="h-3 w-full bg-gray-200 rounded mb-1" />
      <div className="h-3 w-3/4 bg-gray-200 rounded mb-2" />
      <div className="h-2 w-16 bg-gray-200 rounded" />
    </div>
  );
}

export function KanbanColumn({ column, tasks, isLoading, onDismiss }: Props) {
  return (
    <div className="flex flex-col flex-1 min-w-0">
      {/* Column header */}
      <div className={`flex items-center justify-between px-3 py-2 mb-2 rounded-t-lg border-t-4 ${column.borderColor} bg-white shadow-sm`}>
        <h2 className={`font-semibold text-sm ${column.headerColor}`}>{column.label}</h2>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${column.countColor}`}>
          {isLoading ? '…' : tasks.length}
        </span>
      </div>

      {/* Droppable area */}
      <Droppable droppableId={column.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`
              flex-1 rounded-b-lg p-2 min-h-[120px] transition-colors duration-150 scrollbar-thin overflow-y-auto
              ${snapshot.isDraggingOver ? `${column.bgColor} ring-2 ring-inset ring-blue-300` : 'bg-gray-100'}
            `}
            style={{ maxHeight: 'calc(100vh - 180px)' }}
          >
            {isLoading ? (
              <>
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </>
            ) : tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-20 text-gray-400">
                <p className="text-xs text-center">No tasks</p>
              </div>
            ) : (
              [...tasks].sort((a, b) => getUrgencyScore(a) - getUrgencyScore(b)).map((task, idx) => (
                <TaskCard key={task.id} task={task} index={idx} onDismiss={onDismiss} />
              ))
            )}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}
