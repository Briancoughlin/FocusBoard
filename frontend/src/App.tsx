import React, { useState, useEffect, useCallback } from 'react';
import type { Task, Status } from './types';
import { syncAll } from './services/api';
import { Header } from './components/Header';
import { KanbanBoard } from './components/KanbanBoard';
import { SettingsPage } from './components/SettingsPage';
import { PastePanel } from './components/PastePanel';
import { DailyDigest } from './components/DailyDigest';
import { FocusView } from './components/FocusView';
import { JiraDonePrompt } from './components/JiraDonePrompt';

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
  const [view, setView] = useState<'board' | 'focus' | 'settings'>('focus');
  const [rawTasks, setRawTasks] = useState<Task[]>([]);
  const [overrides, setOverrides] = useState<Record<string, Status>>(loadOverrides);
  const [isLoading, setIsLoading] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [errors, setErrors] = useState<Array<{ source: string; error: string }>>([]);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [jiraDoneTask, setJiraDoneTask] = useState<Task | null>(null);
  const [showDigest, setShowDigest] = useState(() => {
    const last = localStorage.getItem('focusboard-digest-date');
    return last !== new Date().toDateString();
  });
  const [completedToday, setCompletedToday] = useState<number>(() => {
    try {
      const raw = localStorage.getItem('focusboard-completed-today');
      if (!raw) return 0;
      const { date, count } = JSON.parse(raw);
      return date === new Date().toDateString() ? count : 0;
    } catch { return 0; }
  });

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

  // Initial fetch + auto-refresh every 5 minutes
  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchTasks]);

  const handleTaskMove = useCallback((taskId: string, newStatus: Status) => {
    const updated = { ...overrides, [taskId]: newStatus };
    setOverrides(updated);
    saveOverrides(updated);
    if (newStatus === 'done' && tasks.find(t => t.id === taskId)?.source === 'jira') {
      setJiraDoneTask(tasks.find(t => t.id === taskId) || null);
    }
    if (newStatus === 'done') {
      // Record when this task was completed
      const completions = JSON.parse(localStorage.getItem('focusboard-done-dates') || '{}');
      completions[taskId] = new Date().toDateString();
      localStorage.setItem('focusboard-done-dates', JSON.stringify(completions));
      setCompletedToday(prev => {
        const next = prev + 1;
        localStorage.setItem('focusboard-completed-today', JSON.stringify({ date: new Date().toDateString(), count: next }));
        return next;
      });
    }
  }, [overrides]);

  const handlePastedTasks = useCallback((newTasks: Task[]) => {
    setPastedTasks(prev => {
      const updated = [...prev, ...newTasks];
      localStorage.setItem('focusboard-pasted-tasks', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const doneDates: Record<string, string> = JSON.parse(localStorage.getItem('focusboard-done-dates') || '{}');
  const today = new Date().toDateString();

  const tasks = applyOverrides([...rawTasks, ...pastedTasks], overrides)
    .filter(t => !dismissed.has(t.id))
    .filter(t => t.status !== 'done' || doneDates[t.id] === today);

  const kanbanTasks = tasks.filter(t => t.source !== 'calendar');

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      <Header
        view={view}
        onViewChange={setView}
        onRefresh={fetchTasks}
        isRefreshing={isLoading}
        lastSynced={lastSynced}
        onPaste={() => setPasteOpen(true)}
        onShowDigest={() => setShowDigest(true)}
        completedToday={completedToday}
      />

      <main className="flex-1 min-h-0 px-6 pt-5 pb-6 overflow-hidden">
        {view === 'board' && (
          <KanbanBoard
            tasks={kanbanTasks}
            isLoading={isLoading}
            onTaskMove={handleTaskMove}
            onOpenSettings={() => setView('settings')}
            onDismiss={handleDismiss}
            errors={errors}
          />
        )}
        {view === 'focus' && (
          <FocusView
            tasks={tasks}
            kanbanTasks={kanbanTasks}
            isLoading={isLoading}
            onTaskMove={handleTaskMove}
            onDismiss={handleDismiss}
            onAddToBoard={task => {
              setPastedTasks(prev => {
                const pinned = { ...task, id: `pinned-${task.id}`, source: 'paste' as const, status: 'todo' as const };
                const updated = [...prev, pinned];
                localStorage.setItem('focusboard-pasted-tasks', JSON.stringify(updated));
                return updated;
              });
            }}
          />
        )}
        {view === 'settings' && <SettingsPage />}
      </main>
      {showDigest && tasks.length > 0 && (
        <DailyDigest
          tasks={tasks}
          onDismiss={() => {
            localStorage.setItem('focusboard-digest-date', new Date().toDateString());
            setShowDigest(false);
          }}
        />
      )}
      {jiraDoneTask && (
        <JiraDonePrompt
          task={jiraDoneTask}
          onOpen={() => { window.open(jiraDoneTask.url, '_blank'); setJiraDoneTask(null); }}
          onDismiss={() => setJiraDoneTask(null)}
        />
      )}
      {pasteOpen && (
        <PastePanel
          onTasksExtracted={handlePastedTasks}
          onClose={() => setPasteOpen(false)}
        />
      )}
    </div>
  );
}
