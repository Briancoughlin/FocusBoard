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
import { JiraCreatePrompt } from './components/JiraCreatePrompt';
import { SlackChannelPrompt } from './components/SlackChannelPrompt';

// Apply user overrides on top of fetched tasks
function applyOverrides(tasks: Task[], overrides: Record<string, Status>): Task[] {
  return tasks.map(task =>
    overrides[task.id] ? { ...task, status: overrides[task.id] } : task
  );
}

// Apply due date overrides on top of fetched tasks
function applyDueDateOverrides(tasks: Task[], dueDateOverrides: Record<string, string>): Task[] {
  return tasks.map(task =>
    dueDateOverrides[task.id] ? { ...task, dueDate: dueDateOverrides[task.id] } : task
  );
}

export default function App() {
  const [view, setView] = useState<'board' | 'focus' | 'settings'>('focus');
  const [rawTasks, setRawTasks] = useState<Task[]>([]);
  const [overrides, setOverrides] = useState<Record<string, Status>>({});
  const overridesRef = useRef<Record<string, Status>>({});
  const [dueDateOverrides, setDueDateOverrides] = useState<Record<string, string>>({});
  const dueDateOverridesRef = useRef<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [errors, setErrors] = useState<Array<{ source: string; error: string }>>([]);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [jiraDoneTask, setJiraDoneTask] = useState<Task | null>(null);
  const [jiraCreateTask, setJiraCreateTask] = useState<Task | null>(null);
  const [activeEpicKey, setActiveEpicKey] = useState<string>('all');
  const [slackChannelPrompt, setSlackChannelPrompt] = useState<string | null>(null);
  const [injectedTasks, setInjectedTasks] = useState<Task[]>([]);
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
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

      if (!autoMode) {
        // Manual mode — use stored values, don't poll Windows
        const accent = manualAccent || '#0078d4';
        const isDark = manualDark ?? false;
        applyTheme(accent, isDark);
        return;
      }

      const windowsTheme = await fetchWindowsTheme();
      applyTheme(windowsTheme.accentColor, windowsTheme.isDark);
    }

    loadTheme();
    const interval = setInterval(loadTheme, 5000);
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
      getPersistedValue<Record<string, string>>('due-date-overrides', {}),
      getPersistedValue<Task[]>('injected-tasks', []),
      getPersistedValue<string[]>('pinned-tasks', []),
    ]).then(([loadedOverrides, loadedPastedTasks, loadedDismissed, loadedCompletedToday, loadedDoneDates, loadedDigestDate, loadedDueDateOverrides, loadedInjectedTasks, loadedPinnedIds]) => {
      overridesRef.current = loadedOverrides;
      setOverrides(loadedOverrides);
      dueDateOverridesRef.current = loadedDueDateOverrides;
      setDueDateOverrides(loadedDueDateOverrides);
      setPastedTasks(loadedPastedTasks);
      setInjectedTasks(loadedInjectedTasks);
      setPinnedIds(new Set(loadedPinnedIds));
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
      const newTasks = result.tasks || [];
      setRawTasks(newTasks);
      setErrors(result.errors || []);
      setLastSynced(new Date());

      // Prompt to add channel ID for unmapped Slack channels
      const slackTasks = newTasks.filter(t => t.source === 'slack' && t.url === 'slack://open');
      if (slackTasks.length > 0 && !slackChannelPrompt) {
        const title = slackTasks[0].title;
        const channelMatch = title?.match(/#([\w-]+)/);
        if (channelMatch) setSlackChannelPrompt(channelMatch[1]);
      }
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

    // Check for Jira done/create prompts — resolve task from current state
    setRawTasks(currentRaw => {
      const allTasks = applyOverrides([...currentRaw], overridesRef.current);
      const moved = allTasks.find(t => t.id === taskId);
      if (newStatus === 'done' && moved?.source === 'jira') {
        setJiraDoneTask(moved);
      }
      if (newStatus === 'inprogress' && moved && moved.source !== 'jira') {
        setJiraCreateTask(moved);
      }
      return currentRaw;
    });
    // Also check pastedTasks / injectedTasks for the inprogress trigger
    setPastedTasks(currentPasted => {
      if (newStatus === 'inprogress') {
        const moved = currentPasted.find(t => t.id === taskId);
        if (moved && moved.source !== 'jira') {
          setJiraCreateTask(moved);
        }
      }
      return currentPasted;
    });
  }, []);

  const handleDueDateChange = useCallback((taskId: string, dateString: string) => {
    const updated = { ...dueDateOverridesRef.current, [taskId]: dateString };
    dueDateOverridesRef.current = updated;
    setDueDateOverrides(updated);
    setPersistedValue('due-date-overrides', updated);
  }, []);

  const handleSlackChannelSave = useCallback(async (channelName: string, channelId: string) => {
    try {
      const res = await fetch('/api/config', { credentials: 'include' });
      const cfg = await res.json();
      const existing = cfg.slackChannelMap || {};
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ slackChannelMap: { ...existing, [channelName]: channelId } }),
      });
    } catch {}
    setSlackChannelPrompt(null);
  }, []);

  const handlePin = useCallback((taskId: string) => {
    setPinnedIds(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId); else next.add(taskId);
      setPersistedValue('pinned-tasks', [...next]);
      return next;
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

  const handleJiraCreated = useCallback((originalTaskId: string, jiraTask: Task) => {
    // Remove original task from pastedTasks if present
    setPastedTasks(prev => {
      const updated = prev.filter(t => t.id !== originalTaskId);
      setPersistedValue('pasted-tasks', updated);
      return updated;
    });
    // Remove override for the original task
    const updatedOverrides = { ...overridesRef.current };
    delete updatedOverrides[originalTaskId];
    overridesRef.current = updatedOverrides;
    setOverrides(updatedOverrides);
    setPersistedValue('overrides', updatedOverrides);
    // Add the jira task to injectedTasks
    setInjectedTasks(prev => {
      const updated = [...prev, jiraTask];
      setPersistedValue('injected-tasks', updated);
      return updated;
    });
    setJiraCreateTask(null);
  }, []);

  const today = new Date().toDateString();

  const tasks = applyDueDateOverrides(
      applyOverrides([...rawTasks, ...pastedTasks, ...injectedTasks], overrides),
      dueDateOverrides
    )
    .filter(t => !dismissed.has(t.id))
    .filter(t => t.status !== 'done' || doneDates[t.id] === today);

  const kanbanTasks = tasks.filter(t => t.source !== 'calendar' && t.source !== 'slack');

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
            onPin={handlePin}
            pinnedIds={pinnedIds}
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
            onDueDateChange={handleDueDateChange}
            onPin={handlePin}
            pinnedIds={pinnedIds}
            onEpicChange={setActiveEpicKey}
            onAddToBoard={task => {
              setPastedTasks(prev => {
                const pinned = { ...task, id: `pinned-${task.id}`, source: 'paste' as const, status: 'todo' as const, priority: 'high' as const };
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
      {slackChannelPrompt && (
        <SlackChannelPrompt
          channelName={slackChannelPrompt}
          onSave={handleSlackChannelSave}
          onDismiss={() => setSlackChannelPrompt(null)}
        />
      )}
      {jiraDoneTask && (
        <JiraDonePrompt
          task={jiraDoneTask}
          onOpen={() => { window.open(jiraDoneTask.url, '_blank'); setJiraDoneTask(null); }}
          onDismiss={() => setJiraDoneTask(null)}
        />
      )}
      {jiraCreateTask && (
        <JiraCreatePrompt
          task={jiraCreateTask}
          onCreated={handleJiraCreated}
          onDismiss={() => setJiraCreateTask(null)}
          suggestedProjectKey={activeEpicKey !== 'all' ? activeEpicKey.split('-')[0] : undefined}
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
