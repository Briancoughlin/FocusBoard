/**
 * @file App.tsx
 * Root component and central state manager for FocusBoard.
 *
 * All task data, user overrides, and UI state live here and flow down as props.
 * The data pipeline is:
 *
 *   rawTasks (from API) + pastedTasks + injectedTasks
 *     → applyOverrides (status overrides from user drag/drop)
 *     → applyDueDateOverrides (due-date changes from calendar drag)
 *     → filter dismissed tasks
 *     → filter done tasks from previous days
 *     → `tasks` (passed to all views)
 *
 * `kanbanTasks` is a further filter of `tasks` that removes calendar events and
 * Slack items, which are displayed in their own dedicated UI sections.
 *
 * Overrides are stored server-side via the persistence API so they survive refreshes.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Task, Status } from './types';
import { syncAll, transitionJiraTicket } from './services/api';
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
import { ReportModal } from './components/ReportModal';
import { UpdateBanner } from './components/UpdateBanner';

/**
 * Merge user-driven status overrides onto the server-fetched tasks.
 * Overrides win unconditionally — they represent explicit decisions the user made
 * by dragging a card, which should not be reverted by a background sync.
 *
 * @param tasks     - Tasks as returned by the sync API.
 * @param overrides - Map of task ID → desired status from persistence.
 */
function applyOverrides(tasks: Task[], overrides: Record<string, Status>): Task[] {
  return tasks.map(task =>
    overrides[task.id] ? { ...task, status: overrides[task.id] } : task
  );
}

/**
 * Merge user-set due-date overrides onto tasks.
 * Applied after applyOverrides so the pipeline is clearly layered:
 * raw → status override → due-date override → filters.
 *
 * @param tasks           - Tasks after status overrides have been applied.
 * @param dueDateOverrides - Map of task ID → ISO date string (YYYY-MM-DD).
 */
function applyDueDateOverrides(tasks: Task[], dueDateOverrides: Record<string, string>): Task[] {
  return tasks.map(task =>
    dueDateOverrides[task.id] ? { ...task, dueDate: dueDateOverrides[task.id] } : task
  );
}

export default function App() {
  const [view, setView] = useState<'board' | 'focus' | 'settings'>('focus');
  const [settingsDirty, setSettingsDirty] = useState(false);

  const handleViewChange = (v: 'board' | 'focus' | 'settings') => {
    if (settingsDirty && view === 'settings' && v !== 'settings') {
      if (!window.confirm('You have unsaved changes in Settings. Leave without saving?')) return;
      setSettingsDirty(false);
    }
    setView(v);
  };
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
  const [reportOpen, setReportOpen] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<any>(null);
  const [updateDismissed, setUpdateDismissed] = useState(false);
  const [completedToday, setCompletedToday] = useState<number>(0);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [pastedTasks, setPastedTasks] = useState<Task[]>([]);
  const [doneDates, setDoneDates] = useState<Record<string, string>>({});
  const [persistenceLoaded, setPersistenceLoaded] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

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

  // Restore all persisted state in one parallel batch before rendering.
  // Using Promise.all means we wait for every key before we flip persistenceLoaded,
  // which prevents a flash where the board renders with empty data then jumps as
  // overrides load. The render is gated on persistenceLoaded to avoid this.
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
    const syncStart = Date.now();
    try {
      const result = await syncAll();
      const syncDuration = Date.now() - syncStart;
      const newTasks = result.tasks || [];
      setRawTasks(newTasks);
      // Surface slow syncs as a warning error so user knows something is sluggish
      const errs = result.errors || [];
      if (syncDuration > 10000) {
        errs.push({ source: 'sync', error: `Sync took ${(syncDuration/1000).toFixed(1)}s — some sources may be slow` });
      }
      setErrors(errs);
      setLastSynced(new Date());

      // Prompt to add channel ID for unmapped Slack channels
      // Prompt to add channel ID for Slack channels that use web URL (not slack:// deep link)
      const unmappedSlack = newTasks.find(t =>
        t.source === 'slack' &&
        t.url &&
        t.url.includes('/messages/') &&
        !t.url.includes('slack://channel')
      );
      if (unmappedSlack && !slackChannelPrompt) {
        const urlMatch = unmappedSlack.url?.match(/\/messages\/([\w-]+)/);
        if (urlMatch && !urlMatch[1].startsWith('@')) {
          setSlackChannelPrompt(urlMatch[1]);
        }
      }
    } catch (err: any) {
      setErrors([{ source: 'sync', error: err.message }]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Check for updates once on startup, then daily
  useEffect(() => {
    const checkUpdate = async () => {
      try {
        const res = await fetch('/api/update/check', { credentials: 'include' });
        const data = await res.json();
        if (data.hasUpdate) setUpdateInfo(data);
      } catch { /* silent fail */ }
    };
    checkUpdate();
    const interval = setInterval(checkUpdate, 24 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Offline detection — placed after fetchTasks is defined so the online handler can call it
  useEffect(() => {
    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => { setIsOffline(false); fetchTasks(); };
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [fetchTasks]);

  // Initial fetch + auto-refresh every 5 minutes
  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchTasks]);

  /**
   * Handle a card being moved to a new kanban column.
   *
   * Side effects (beyond updating local state):
   *  - Persists the new status override so it survives a page refresh / re-sync.
   *  - For Jira cards: fires a background API call to transition the Jira ticket.
   *    The call is fire-and-forget — failure is logged but does not revert the card.
   *  - When a Jira card lands in "done": prompts the user to add a closing comment.
   *  - When a non-Jira card lands in "inprogress": prompts the user to create a
   *    Jira ticket for it (so the work is tracked in Jira going forward).
   *
   * Functional updaters (`setRawTasks(current => ...)`) are used throughout because
   * this callback has empty deps — it must read current task arrays via the updater
   * argument rather than via closed-over state to avoid stale closure bugs.
   */
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

    // Attempt to sync the status change back to Jira for Jira-sourced cards.
    // We search across all three task arrays (rawTasks, pastedTasks, injectedTasks)
    // because Jira cards can live in any of them depending on how they arrived.
    setRawTasks(currentRaw => {
      const movedTask = currentRaw.find(t => t.id === taskId);
      if (movedTask?.source === 'jira' && movedTask?.ticketKey) {
        transitionJiraTicket(movedTask.ticketKey, newStatus).then(result => {
          if (!result.success) console.warn('Jira transition failed:', result.error);
        });
        if (newStatus === 'done') setJiraDoneTask(movedTask);
      }
      return currentRaw;
    });
    setPastedTasks(currentPasted => {
      const movedTask = currentPasted.find(t => t.id === taskId);
      if (movedTask?.source === 'jira' && movedTask?.ticketKey) {
        transitionJiraTicket(movedTask.ticketKey, newStatus).then(result => {
          if (!result.success) console.warn('Jira transition failed:', result.error);
        });
      }
      return currentPasted;
    });
    setInjectedTasks(currentInjected => {
      const movedTask = currentInjected.find(t => t.id === taskId);
      if (movedTask?.source === 'jira' && movedTask?.ticketKey) {
        transitionJiraTicket(movedTask.ticketKey, newStatus).then(result => {
          if (!result.success) console.warn('Jira transition failed:', result.error);
        });
      }
      return currentInjected;
    });

    // Offer to create a Jira ticket when a non-Jira task starts being worked on.
    // We need to apply overrides before searching so we find the task with its
    // up-to-date status (the override was just written to overridesRef.current).
    setRawTasks(currentRaw => {
      const allTasks = applyOverrides([...currentRaw], overridesRef.current);
      const moved = allTasks.find(t => t.id === taskId);
      if (newStatus === 'inprogress' && moved && moved.source !== 'jira') {
        setJiraCreateTask(moved);
      }
      return currentRaw;
    });
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

  /**
   * Toggle a task between 'wontdo' and 'done'.
   * Calling this on a card that is already 'wontdo' returns it to 'done' so the
   * user can undo an accidental won't-do marking without dragging.
   */
  const handleWontDo = useCallback((taskId: string) => {
    const currentStatus = overridesRef.current[taskId];
    const newStatus = currentStatus === 'wontdo' ? 'done' : 'wontdo';
    const updated = { ...overridesRef.current, [taskId]: newStatus as Status };
    overridesRef.current = updated;
    setOverrides(updated);
    setPersistedValue('overrides', updated);
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

    // Only inject into local state if In Progress — otherwise let next Jira sync pick it up
    if (jiraTask.status === 'inprogress') {
      // Mark as pinned so it always shows in Focus view regardless of priority/due date
      setPinnedIds(prev => {
        const next = new Set(prev).add(jiraTask.id);
        setPersistedValue('pinned-tasks', [...next]);
        return next;
      });
      setInjectedTasks(prev => {
        const updated = [...prev, jiraTask];
        setPersistedValue('injected-tasks', updated);
        return updated;
      });
    }
    // If not in progress, dismiss the original card and Jira sync will bring it back correctly
    setJiraCreateTask(null);
  }, []);

  const today = new Date().toDateString();

  // --- Task derivation pipeline ---
  // Three task arrays are merged then processed through a chain of pure transforms:
  //   1. applyOverrides: status changes the user made via drag-and-drop
  //   2. applyDueDateOverrides: due dates changed via calendar drag
  //   3. Filter dismissed: permanently hidden by the user
  //   4. Filter stale done: hide tasks completed on previous days (keep today's done
  //      so the "completed today" counter is accurate and cards don't vanish mid-session)
  //   5. wontdo tasks pass the done filter because they are displayed in the Done column
  //      but should never expire like regular done tasks
  const tasks = applyDueDateOverrides(
      applyOverrides([...rawTasks, ...pastedTasks, ...injectedTasks], overrides),
      dueDateOverrides
    )
    .filter(t => !dismissed.has(t.id))
    .filter(t => t.status === 'wontdo' || t.status !== 'done' || doneDates[t.id] === today);

  // Calendar events and Slack messages are shown in their own UI sections (WeekView
  // and InboxSidebar) — exclude them from the kanban columns to avoid duplication.
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
      {updateInfo && !updateDismissed && (
        <UpdateBanner update={updateInfo} onDismiss={() => setUpdateDismissed(true)} />
      )}
      {isOffline && (
        <div
          style={{
            backgroundColor: 'var(--accent)',
            color: '#fff',
            textAlign: 'center',
            padding: '0.4rem 1rem',
            fontSize: '0.85rem',
            fontWeight: 500,
            flexShrink: 0,
            opacity: 0.92,
          }}
        >
          You're offline — FocusBoard will sync when reconnected
        </div>
      )}
      <Header
        view={view}
        onViewChange={handleViewChange}
        onRefresh={fetchTasks}
        isRefreshing={isLoading}
        lastSynced={lastSynced}
        onPaste={() => setPasteOpen(true)}
        onShowDigest={() => setShowDigest(true)}
        onShowReport={() => setReportOpen(true)}
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
            onWontDo={handleWontDo}
            errors={isOffline ? [] : errors}
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
            onWontDo={handleWontDo}
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
        {view === 'settings' && <SettingsPage onDirtyChange={setSettingsDirty} />}
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
          jiraTasks={tasks.filter(t => t.source === 'jira')}
        />
      )}
      {pasteOpen && (
        <PastePanel
          onTasksExtracted={handlePastedTasks}
          onClose={() => setPasteOpen(false)}
        />
      )}
      {reportOpen && (
        <ReportModal
          tasks={tasks}
          doneDates={doneDates}
          onClose={() => setReportOpen(false)}
        />
      )}
    </div>
  );
}
