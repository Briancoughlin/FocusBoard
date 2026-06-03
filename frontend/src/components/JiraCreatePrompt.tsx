import React, { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import type { Task } from '../types';

interface Props {
  task: Task;
  onCreated: (originalTaskId: string, jiraTask: Task) => void;
  onDismiss: () => void;
  suggestedProjectKey?: string; // from active epic filter
}

interface JiraProject {
  key: string;
  name: string;
}

const ISSUE_TYPES = ['Task', 'Story', 'Bug', 'Spike'];

export function JiraCreatePrompt({ task, onCreated, onDismiss, suggestedProjectKey }: Props) {
  const [summary, setSummary] = useState(task.title);
  const [description, setDescription] = useState(task.description || '');
  const [projectKey, setProjectKey] = useState('');
  const [issueType, setIssueType] = useState('Task');
  const [projects, setProjects] = useState<JiraProject[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoadingProjects(true);
    fetch('/api/jira/projects', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        const list: JiraProject[] = data.projects || [];
        // Filter to default project if set, otherwise show all
        const defaultProject = suggestedProjectKey || data.defaultProject || '';
        const filtered = defaultProject
          ? list.filter(p => p.key === defaultProject)
          : list;
        setProjects(filtered.length > 0 ? filtered : list);
        const preferred = filtered.find(p => p.key === defaultProject) || filtered[0] || list[0];
        if (preferred) setProjectKey(preferred.key);
      })
      .catch(err => {
        setError('Failed to load projects: ' + err.message);
      })
      .finally(() => setLoadingProjects(false));
  }, []);

  async function handleCreate() {
    if (!projectKey) {
      setError('Please select a project.');
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/jira/create', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary, description, projectKey, issueType }),
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
        priority: 'medium',
        url: data.url,
        ticketKey: data.key,
        updatedAt: new Date().toISOString(),
      };

      onCreated(task.id, jiraTask);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="jira-create-title">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-blue-700 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 id="jira-create-title" className="text-white font-semibold text-lg">Track in Jira?</h2>
            <p className="text-blue-100 text-xs mt-0.5">Create a ticket to track this work</p>
          </div>
          <button onClick={onDismiss} className="text-white/70 hover:text-white transition-colors" aria-label="Close Jira create dialog">
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Summary */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Summary</label>
            <input
              type="text"
              value={summary}
              onChange={e => setSummary(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="Ticket summary"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
              placeholder="Optional description"
            />
          </div>

          {/* Project */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Project</label>
            {loadingProjects ? (
              <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
                <Loader2 size={14} className="animate-spin" />
                Loading...
              </div>
            ) : (
              <select
                value={projectKey}
                onChange={e => setProjectKey(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
              >
                {projects.length === 0 && (
                  <option value="">No projects found</option>
                )}
                {projects.map(p => (
                  <option key={p.key} value={p.key}>{p.name} ({p.key})</option>
                ))}
              </select>
            )}
          </div>

          {/* Issue Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Issue Type</label>
            <select
              value={issueType}
              onChange={e => setIssueType(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
            >
              {ISSUE_TYPES.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 flex gap-3">
          <button
            onClick={handleCreate}
            disabled={creating || loadingProjects}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors"
          >
            {creating && <Loader2 size={14} className="animate-spin" />}
            {creating ? 'Creating...' : 'Create Ticket'}
          </button>
          <button
            onClick={onDismiss}
            className="px-4 py-2.5 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-xl transition-colors"
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}
