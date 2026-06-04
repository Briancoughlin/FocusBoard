import React, { useState } from 'react';
import { X, BarChart2, Copy, Check, Loader2 } from 'lucide-react';
import type { Task } from '../types';

interface Props {
  tasks: Task[];
  doneDates: Record<string, string>; // taskId -> dateString when moved to done
  onClose: () => void;
}

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day; // adjust so Monday = 0
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function getSunday(d: Date): Date {
  const monday = getMonday(d);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return sunday;
}

export function ReportModal({ tasks, doneDates, onClose }: Props) {
  const [period, setPeriod] = useState<'today' | 'week'>('today');
  const [report, setReport] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string>('');

  const today = new Date().toDateString();
  const monday = getMonday(new Date());
  const sunday = getSunday(new Date());

  function isThisWeek(dateStr: string): boolean {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    return d >= monday && d <= sunday;
  }

  function getFilteredTasks(): Task[] {
    return tasks.filter(t => {
      if (t.status !== 'done' && t.status !== 'wontdo') return false;
      const doneDate = doneDates[t.id];
      if (!doneDate) return false;
      if (period === 'today') return doneDate === today;
      return isThisWeek(doneDate);
    });
  }

  async function handleGenerate() {
    setLoading(true);
    setError('');
    setReport('');

    const filtered = getFilteredTasks();

    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          tasks: filtered.map(t => ({
            title: t.title,
            description: t.description,
            source: t.source,
            ticketKey: t.ticketKey,
            status: t.status,
            fixVersion: t.fixVersion,
          })),
          period,
        }),
      });

      if (!res.ok) {
        throw new Error(`Server error: ${res.status}`);
      }

      const data = await res.json();
      setReport(data.report || '');
    } catch (err: any) {
      setError(err.message || 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const ta = document.createElement('textarea');
      ta.value = report;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  const filteredCount = getFilteredTasks().length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-lg rounded-xl shadow-2xl flex flex-col"
        style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', maxHeight: '80vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2">
            <BarChart2 size={18} className="text-blue-500" />
            <h2 className="text-base font-semibold" style={{ color: 'var(--text)' }}>Generate Report</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-4 p-5 flex-1 min-h-0">
          {/* Period toggle */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 w-fit">
            {(['today', 'week'] as const).map(p => (
              <button
                key={p}
                onClick={() => { setPeriod(p); setReport(''); setError(''); }}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                  period === p
                    ? 'text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                style={period === p ? { backgroundColor: 'var(--accent)' } : {}}
              >
                {p === 'today' ? 'Today' : 'This Week'}
              </button>
            ))}
          </div>

          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {filteredCount === 0
              ? `No completed tasks for ${period === 'today' ? 'today' : 'this week'}.`
              : `${filteredCount} task${filteredCount !== 1 ? 's' : ''} will be included.`}
          </p>

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={loading || filteredCount === 0}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            {loading ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <BarChart2 size={15} />
                Generate Report
              </>
            )}
          </button>

          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}

          {/* Report output */}
          {report && (
            <div className="flex flex-col gap-2 flex-1 min-h-0">
              <textarea
                readOnly
                value={report}
                className="flex-1 min-h-0 w-full rounded-lg p-3 text-sm font-mono resize-none outline-none"
                style={{
                  backgroundColor: 'var(--bg)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                  minHeight: '200px',
                }}
              />
              <button
                onClick={handleCopy}
                className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
                style={{
                  backgroundColor: copied ? 'var(--bg-success, #d1fae5)' : 'var(--bg)',
                  border: '1px solid var(--border)',
                  color: copied ? '#059669' : 'var(--text)',
                }}
              >
                {copied ? (
                  <>
                    <Check size={15} />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy size={15} />
                    Copy to Clipboard
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
