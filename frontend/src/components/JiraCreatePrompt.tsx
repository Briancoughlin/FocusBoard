import React, { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import type { Task } from '../types';

interface Props {
  task: Task;
  onCreated: (originalTaskId: string, jiraTask: Task) => void;
  onDismiss: () => void;
  suggestedProjectKey?: string;
  jiraTasks?: Task[];
}

interface JiraProject { key: string; name: string; }

const ISSUE_TYPES = ['Task', 'Story', 'Bug', 'Spike'];
const PRIORITIES = ['Critical', 'High', 'Medium', 'Low'];

export function JiraCreatePrompt({ task, onCreated, onDismiss, suggestedProjectKey, jiraTasks = [] }: Props) {
  const [summary, setSummary] = useState(task.title);
  const [description, setDescription] = useState(task.description || '');
  const [projectKey, setProjectKey] = useState('');
  const [issueType, setIssueType] = useState('Task');
  const [priority, setPriority] = useState('Medium');
  const [fixVersion, setFixVersion] = useState('');
  const [projects, setProjects] = useState<JiraProject[]>([]);
  const [fixVersions, setFixVersions] = useState<string[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Extract unique project keys from existing Jira tasks
    const projectKeys = [...new Set(
      jiraTasks.filter(t => t.ticketKey).map(t => t.ticketKey!.split('-')[0])
    )].sort();

    // Extract unique fix versions from existing Jira tasks
    const versions = [...new Set(
      jiraTasks.filter(t => t.fixVersion).map(t => t.fixVersion!)
    )].sort();
    setFixVersions(versions);
    if (versions.length > 0) setFixVersion(versions[0]);

    if (projectKeys.length > 0) {
      const list = projectKeys.map(k => ({ key: k, name: k }));
      const preferred = suggestedProjectKey
        ? list.find(p => p.key === suggestedProjectKey) || list[0]
        : list[0];
      setProjects(list);
      if (preferred) setProjectKey(preferred.key);
      setLoadingProjects(false);
    } else {
      fetch('/api/jira/projects', { credentials: 'include' })
        .then(r => r.json())
        .then(data => {
          const list: JiraProject[] = data.projects || [];
          const defaultProject = suggestedProjectKey || data.defaultProject || '';
          const filtered = defaultProject ? list.filter(p => p.key === defaultProject) : list;
          setProjects(filtered.length > 0 ? filtered : list);
          const preferred = filtered[0] || list[0];
          if (preferred) setProjectKey(preferred.key);
        })
        .catch(err => setError('Failed to load projects: ' + err.message))
        .finally(() => setLoadingProjects(false));
    }
  }, [jiraTasks, suggestedProjectKey]);

  async function handleCreate() {
    if (!projectKey) { setError('Please select a project.'); return; }
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/jira/create', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary, description, projectKey, issueType, priority, fixVersion: fixVersion || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create ticket');

      const jiraTask: Task = {
        id: `jira-${data.id}`,
        sourceId: data.id,
        title: summary,
        description,
        source: 'jira',
        status: 'inprogress',
        priority: priority.toLowerCase() as 'high' | 'medium' | 'low',
        url: data.url,
        ticketKey: data.key,
        fixVersion: fixVersion || undefined,
        updatedAt: new Date().toISOString(),
      };

      onCreated(task.id, jiraTask);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  const selectClass = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white";

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="jira-create-title">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-gradient-to-r from-blue-500 to-blue-700 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 id="jira-create-title" className="text-white font-semibold text-lg">Track in Jira?</h2>
            <p className="text-blue-100 text-xs mt-0.5">Create a ticket to track this work</p>
          </div>
          <button onClick={onDismiss} className="text-white/70 hover:text-white transition-colors" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-3">
          {/* Summary */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Summary</label>
            <input type="text" value={summary} onChange={e => setSummary(e.target.value)}
              className={selectClass} placeholder="Ticket summary" />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              rows={2} className={`${selectClass} resize-none`} placeholder="Optional description" />
          </div>

          {/* Row: Project + Issue Type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Project</label>
              {loadingProjects ? (
                <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
                  <Loader2 size={14} className="animate-spin" /> Loading...
                </div>
              ) : (
                <select value={projectKey} onChange={e => setProjectKey(e.target.value)} className={selectClass}>
                  {projects.map(p => <option key={p.key} value={p.key}>{p.key}</option>)}
                </select>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Issue Type</label>
              <select value={issueType} onChange={e => setIssueType(e.target.value)} className={selectClass}>
                {ISSUE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {/* Row: Priority + Fix Version */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <select value={priority} onChange={e => setPriority(e.target.value)} className={selectClass}>
                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fix Version</label>
              <select value={fixVersion} onChange={e => setFixVersion(e.target.value)} className={selectClass}>
                <option value="">None</option>
                {fixVersions.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        <div className="px-5 pb-5 flex gap-3">
          <button onClick={handleCreate} disabled={creating || loadingProjects}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors">
            {creating && <Loader2 size={14} className="animate-spin" />}
            {creating ? 'Creating...' : 'Create Ticket'}
          </button>
          <button onClick={onDismiss}
            className="px-4 py-2.5 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-xl transition-colors">
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}
