import React, { useState, useEffect, useCallback } from 'react';
import type { Task, Status } from './types';
import { syncAll } from './services/api';
import { Header } from './components/Header';
import { KanbanBoard } from './components/KanbanBoard';
import { SettingsPage } from './components/SettingsPage';
import { PastePanel } from './components/PastePanel';

const STORAGE_KEY = 'focusboard-overrides';

// Load column overrides (manual drags) from localStorage
function loadOverrides(): Record<string, Status> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveOverrides(overrides: Record<string, Status>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
}

// Apply user overrides on top of fetched tasks
function applyOverrides(tasks: Task[], overrides: Record<string, Status>): Task[] {
  return tasks.map(task =>
    overrides[task.id] ? { ...task, status: overrides[task.id] } : task
  );
}

export default function App() {
  const [view, setView] = useState<'board' | 'settings'>('board');
  const [rawTasks, setRawTasks] = useState<Task[]>([]);
  const [overrides, setOverrides] = useState<Record<string, Status>>(loadOverrides);
  const [isLoading, setIsLoading] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [errors, setErrors] = useState<Array<{ source: string; error: string }>>([]);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem('focusboard-dismissed');
      return new Set(raw ? JSON.parse(raw) : []);
    } catch { return new Set(); }
  });

  const handleDismiss = useCallback((taskId: string) => {
    setDismissed(prev => {
      const updated = new Set(prev).add(taskId);
      localStorage.setItem('focusboard-dismissed', JSON.stringify([...updated]));
      return updated;
    });
  }, []);

  const [pastedTasks, setPastedTasks] = useState<Task[]>(() => {
    try {
      const raw = localStorage.getItem('focusboard-pasted-tasks');
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });

  const fetchTasks = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await syncAll();
      setRawTasks(result.tasks || []);
      setErrors(result.errors || []);
      setLastSynced(new Date());
    } catch (err: any) {
      setErrors([{ source: 'sync', error: err.message }]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleTaskMove = useCallback((taskId: string, newStatus: Status) => {
    const updated = { ...overrides, [taskId]: newStatus };
    setOverrides(updated);
    saveOverrides(updated);
  }, [overrides]);

  const handlePastedTasks = useCallback((newTasks: Task[]) => {
    setPastedTasks(prev => {
      const updated = [...prev, ...newTasks];
      localStorage.setItem('focusboard-pasted-tasks', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const tasks = applyOverrides([...rawTasks, ...pastedTasks], overrides).filter(t => !dismissed.has(t.id));

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header
        view={view}
        onViewChange={setView}
        onRefresh={fetchTasks}
        isRefreshing={isLoading}
        lastSynced={lastSynced}
        onPaste={() => setPasteOpen(true)}
      />

      <main className="flex-1 px-6 pt-5 pb-6 overflow-hidden">
        {view === 'board' ? (
          <KanbanBoard
            tasks={tasks}
            isLoading={isLoading}
            onTaskMove={handleTaskMove}
            onOpenSettings={() => setView('settings')}
            onDismiss={handleDismiss}
            errors={errors}
          />
        ) : (
          <SettingsPage />
        )}
      </main>
      {pasteOpen && (
        <PastePanel
          onTasksExtracted={handlePastedTasks}
          onClose={() => setPasteOpen(false)}
        />
      )}
    </div>
  );
}
