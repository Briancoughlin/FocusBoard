import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Task, Status } from './types';
import { syncAll } from './services/api';
import { getPersistedValue, setPersistedValue } from './services/persistence';
import { fetchWindowsTheme, applyTheme } from './services/theme';
import { Header } from './components/Header';
import { KanbanBoard } from './components/KanbanBoard';
import { SettingsPage } from './components/SettingsPage';
import { PastePanel } from './components/PastePanel';
import { DailyDigest } from './components/DailyDigest';
import { FocusView } from './components/FocusView';
import { JiraDonePrompt } from './components/JiraDonePrompt';

// Apply user overrides on top of fetched tasks
function applyOverrides(tasks: Task[], overrides: Record<string, Status>): Task[] {
  return tasks.map(task =>
    overrides[task.id] ? { ...task, status: overrides[task.id] } : task
  );
}

export default function App() {
  const [view, setView] = useState<'board' | 'focus' | 'settings'>('focus');
  const [rawTasks, setRawTasks] = useState<Task[]>([]);
  const [overrides, setOverrides] = useState<Record<string, Status>>({});
  const overridesRef = useRef<Record<string, Status>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [errors, setErrors] = useState<Array<{ source: string; error: string }>>([]);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [jiraDoneTask, setJiraDoneTask] = useState<Task | null>(null);
  const [showDigest, setShowDigest] = useState(false);
  const [completedToday, setCompletedToday] = useState<number>(0);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [pastedTasks, setPastedTasks] = useState<Task[]>([]);
  const [doneDates, setDoneDates] = useState<Record<string, string>>({});
  const [persistenceLoaded, setPersistenceLoaded] = useState(false);

  // Theme: fetch Windows accent/dark-mode on mount, re-check every 30s
  useEffect(() => {
    async function loadTheme() {
      const [manualAccent, manualDark, autoMode] = await Promise.all([
        getPersistedValue<string | null>('theme-accent', null),
        getPersistedValue<boolean | null>('theme-dark', null),
        getPersistedValue<boolean>('theme-auto', true),
      ]);

      if (!autoMode && manualAccent !== null && manualDark !== null) {
        applyTheme(manualAccent, manualDark);
        return;
      }

      const windowsTheme = await fetchWindowsTheme();
      const accent = (!autoMode && manualAccent) ? manualAccent : windowsTheme.accentColor;
      const isDark = (!autoMode && manualDark !== null) ? manualDark : windowsTheme.isDark;
      applyTheme(accent, isDark);
    }

    loadTheme();
    const interval = setInterval(loadTheme, 30000);
    return () => clearInterval(interval);
  }, []);

  // Load all persisted values on mount
  useEffect(() => {
    const today = new Date().toDateString();

    Promise.all([
      getPersistedValue<Record<string, Status>>('overrides', {}),
      getPersistedValue<Task[]>('pasted-tasks', []),
      getPersistedValue<string[]>('dismissed', []),
      getPersistedValue<{ date: string; count: number } | null>('completed-today', null),
      getPersistedValue<Record<string, string>>('done-dates', {}),
      getPersistedValue<string | null>('digest-date', null),
    ]).then(([loadedOverrides, loadedPastedTasks, loadedDismissed, loadedCompletedToday, loadedDoneDates, loadedDigestDate]) => {
      overridesRef.current = loadedOverrides;
      setOverrides(loadedOverrides);
      setPastedTasks(loadedPastedTasks);
      setDismissed(new Set(loadedDismissed));
      setDoneDates(loadedDoneDates);

      if (loadedCompletedToday && loadedCompletedToday.date === today) {
        setCompletedToday(loadedCompletedToday.count);
      }

      setShowDigest(loadedDigestDate !== today);
      setPersistenceLoaded(true);
    });
  }, []);

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
    const updated = { ...overridesRef.current, [taskId]: newStatus };
    overridesRef.current = updated;
    setOverrides(updated);
    setPersistedValue('overrides', updated);

    if (newStatus === 'done') {
      setDoneDates(prev => {
        const next = { ...prev, [taskId]: new Date().toDateString() };
        setPersistedValue('done-dates', next);
        return next;
      });
      setCompletedToday(prev => {
        const next = prev + 1;
        setPersistedValue('completed-today', { date: new Date().toDateString(), count: next });
        return next;
      });
    }

    // Check for Jira done prompt — need access to tasks derived state
    // We resolve the task from current rawTasks + pastedTasks
    setRawTasks(currentRaw => {
      if (newStatus === 'done') {
        const allTasks = applyOverrides([...currentRaw], overridesRef.current);
        const moved = allTasks.find(t => t.id === taskId);
        if (moved?.source === 'jira') {
          setJiraDoneTask(moved);
        }
      }
      return currentRaw;
    });
  }, []);

  const handleDismiss = useCallback((taskId: string) => {
    setDismissed(prev => {
      const updated = new Set(prev).add(taskId);
      setPersistedValue('dismissed', [...updated]);
      return updated;
    });
  }, []);

  const handlePastedTasks = useCallback((newTasks: Task[]) => {
    setPastedTasks(prev => {
      const updated = [...prev, ...newTasks];
      setPersistedValue('pasted-tasks', updated);
      return updated;
    });
  }, []);

  const today = new Date().toDateString();

  const tasks = applyOverrides([...rawTasks, ...pastedTasks], overrides)
    .filter(t => !dismissed.has(t.id))
    .filter(t => t.status !== 'done' || doneDates[t.id] === today);

  const kanbanTasks = tasks.filter(t => t.source !== 'calendar');

  if (!persistenceLoaded) {
    return (
      <div className="h-screen flex flex-col overflow-hidden" style={{ backgroundColor: 'var(--bg)' }}>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ backgroundColor: 'var(--bg)' }}>
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

      <main className={`flex-1 min-h-0 px-6 pt-5 pb-6 ${view === 'settings' ? 'overflow-y-auto' : 'overflow-hidden'}`} style={{ backgroundColor: 'var(--bg)' }}>
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
                setPersistedValue('pasted-tasks', updated);
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
            setPersistedValue('digest-date', new Date().toDateString());
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
