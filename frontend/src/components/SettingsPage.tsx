import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, ExternalLink, Save, TestTube, Loader2 } from 'lucide-react';
import type { Config } from '../types';
import { getConfig, saveConfig, getGoogleAuthUrl } from '../services/api';

type TestState = 'idle' | 'testing' | 'ok' | 'error';

function StatusIcon({ configured }: { configured?: boolean }) {
  if (configured === undefined) return null;
  return configured
    ? <CheckCircle size={16} className="text-emerald-500 flex-shrink-0" />
    : <XCircle size={16} className="text-red-400 flex-shrink-0" />;
}

interface SectionProps {
  title: string;
  description: string;
  configured?: boolean;
  children: React.ReactNode;
}

function Section({ title, description, configured, children }: SectionProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
      <div className="flex items-start justify-between mb-1">
        <h3 className="font-semibold text-gray-900 text-base">{title}</h3>
        <StatusIcon configured={configured} />
      </div>
      <p className="text-sm text-gray-500 mb-4">{description}</p>
      {children}
    </div>
  );
}

interface FieldProps {
  label: string;
  id: string;
  type?: string;
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
  hint?: string;
}

function Field({ label, id, type = 'text', value, placeholder, onChange, hint }: FieldProps) {
  return (
    <div className="mb-3">
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
        autoComplete="off"
      />
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

export function SettingsPage() {
  const [config, setConfig] = useState<Config>({});
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testStates, setTestStates] = useState<Record<string, TestState>>({});
  const [testMessages, setTestMessages] = useState<Record<string, string>>({});

  useEffect(() => {
    getConfig().then(cfg => {
      setConfig(cfg);
      // Pre-fill non-secret fields
      setForm({
        jiraUrl: cfg.jiraUrl || '',
        jiraEmail: cfg.jiraEmail || '',
        jiraToken: '',
        jiraJql: cfg.jiraJql || '',
        googleClientId: cfg.googleClientId || '',
        googleClientSecret: '',
        slackToken: '',
        githubToken: '',
        githubBaseUrl: cfg.githubBaseUrl || '',
        anthropicKey: '',
        anthropicBaseUrl: cfg.anthropicBaseUrl || '',
      });
    });
  }, []);

  const setField = (key: string, value: string) =>
    setForm(f => ({ ...f, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveConfig(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      const updated = await getConfig();
      setConfig(updated);
    } catch (err) {
      alert('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async (source: string, url: string) => {
    setTestStates(s => ({ ...s, [source]: 'testing' }));
    setTestMessages(m => ({ ...m, [source]: '' }));
    try {
      const res = await fetch(url, { credentials: 'include' });
      const data = await res.json();
      if (data.error) {
        setTestStates(s => ({ ...s, [source]: 'error' }));
        setTestMessages(m => ({ ...m, [source]: data.error }));
      } else {
        setTestStates(s => ({ ...s, [source]: 'ok' }));
        setTestMessages(m => ({ ...m, [source]: `Connected — ${data.tasks?.length ?? 0} items fetched` }));
      }
    } catch (err: any) {
      setTestStates(s => ({ ...s, [source]: 'error' }));
      setTestMessages(m => ({ ...m, [source]: err.message }));
    }
  };

  const openGoogleAuth = () => {
    window.open(getGoogleAuthUrl(), '_blank', 'width=600,height=700');
  };

  function TestButton({ source, url }: { source: string; url: string }) {
    const state = testStates[source] || 'idle';
    const msg = testMessages[source];
    return (
      <div>
        <button
          onClick={() => testConnection(source, url)}
          disabled={state === 'testing'}
          className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          {state === 'testing'
            ? <Loader2 size={14} className="animate-spin" />
            : <TestTube size={14} />}
          Test Connection
        </button>
        {msg && (
          <p className={`text-xs mt-1 ${state === 'ok' ? 'text-emerald-600' : 'text-red-500'}`}>
            {msg}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-6 overflow-y-auto h-full">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-500 mt-1">Configure your integrations to start aggregating tasks.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all shadow-sm ${
            saved
              ? 'bg-emerald-500 text-white'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          } disabled:opacity-50`}
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          {saved ? 'Saved!' : 'Save All'}
        </button>
      </div>

      {/* Anthropic */}
      <Section
        title="Anthropic (Claude AI)"
        description="Required for Gmail and Slack action item extraction using Claude."
        configured={config.anthropicConfigured}
      >
        <Field
          label="API Key"
          id="anthropicKey"
          type="password"
          value={form.anthropicKey || ''}
          placeholder={config.anthropicConfigured ? '••••••••••••' : 'sk-ant-...'}
          onChange={v => setField('anthropicKey', v)}
          hint="Standard Anthropic key, or your Unity U-AI token"
        />
        <Field
          label="Base URL (optional)"
          id="anthropicBaseUrl"
          value={form.anthropicBaseUrl || ''}
          placeholder="https://uai-litellm.internal.unity.com"
          onChange={v => setField('anthropicBaseUrl', v)}
          hint="Unity employees: use the U-AI gateway URL here. Leave blank for standard Anthropic."
        />
        <a
          href="https://console.anthropic.com/account/keys"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
        >
          <ExternalLink size={11} /> Get API key
        </a>
      </Section>

      {/* Jira */}
      <Section
        title="Jira"
        description="Fetch issues assigned to you from your Jira workspace."
        configured={config.jiraConfigured}
      >
        <Field
          label="Jira Base URL"
          id="jiraUrl"
          value={form.jiraUrl || ''}
          placeholder="https://yourorg.atlassian.net"
          onChange={v => setField('jiraUrl', v)}
        />
        <Field
          label="Email"
          id="jiraEmail"
          type="email"
          value={form.jiraEmail || ''}
          placeholder="you@company.com"
          onChange={v => setField('jiraEmail', v)}
        />
        <Field
          label="Personal Access Token"
          id="jiraToken"
          type="password"
          value={form.jiraToken || ''}
          placeholder={config.jiraToken ? '••••••••••••' : 'Paste token...'}
          onChange={v => setField('jiraToken', v)}
          hint="Account Settings → Security → API tokens"
        />
        <Field
          label="JQL Filter (optional)"
          id="jiraJql"
          value={form.jiraJql || ''}
          placeholder="assignee=currentUser() AND resolution=Unresolved ORDER BY updated DESC"
          onChange={v => setField('jiraJql', v)}
          hint="Paste your Jira filter JQL here to show exactly the tickets you want"
        />
        <div className="flex items-center gap-3 mt-1">
          <TestButton source="jira" url="/api/jira" />
          <a
            href="https://id.atlassian.com/manage-profile/security/api-tokens"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
          >
            <ExternalLink size={11} /> Create token
          </a>
        </div>
      </Section>

      {/* Google */}
      <Section
        title="Google (Gmail + Calendar)"
        description="Access Gmail for action items and Google Calendar for upcoming events."
        configured={config.googleConfigured}
      >
        <Field
          label="OAuth Client ID"
          id="googleClientId"
          value={form.googleClientId || ''}
          placeholder="123456789-abc.apps.googleusercontent.com"
          onChange={v => setField('googleClientId', v)}
        />
        <Field
          label="OAuth Client Secret"
          id="googleClientSecret"
          type="password"
          value={form.googleClientSecret || ''}
          placeholder={config.googleClientSecret ? '••••••••••••' : 'GOCSPX-...'}
          onChange={v => setField('googleClientSecret', v)}
          hint="Google Cloud Console → APIs & Services → Credentials"
        />
        <div className="flex flex-wrap items-center gap-3 mt-2">
          <button
            onClick={openGoogleAuth}
            disabled={!form.googleClientId && !config.googleClientId}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-40 shadow-sm transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Connect Google Account
          </button>
          {config.googleConfigured && (
            <span className="flex items-center gap-1 text-sm text-emerald-600">
              <CheckCircle size={14} /> Connected
            </span>
          )}
        </div>
        <div className="flex gap-3 mt-3">
          <TestButton source="gmail" url="/api/gmail" />
          <TestButton source="calendar" url="/api/calendar" />
        </div>
        <a
          href="https://console.cloud.google.com/apis/credentials"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-2"
        >
          <ExternalLink size={11} /> Google Cloud Console
        </a>
      </Section>

      {/* Slack */}
      <Section
        title="Slack"
        description="Fetch DMs and mentions from your Slack workspace."
        configured={config.slackConfigured}
      >
        <Field
          label="Bot Token"
          id="slackToken"
          type="password"
          value={form.slackToken || ''}
          placeholder={config.slackToken ? '••••••••••••' : 'xoxb-...'}
          onChange={v => setField('slackToken', v)}
          hint="api.slack.com/apps → OAuth & Permissions → Bot User OAuth Token"
        />
        <div className="flex items-center gap-3 mt-1">
          <TestButton source="slack" url="/api/slack" />
          <a
            href="https://api.slack.com/apps"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
          >
            <ExternalLink size={11} /> Slack Apps
          </a>
        </div>
      </Section>

      {/* GitHub */}
      <Section
        title="GitHub"
        description="Pull requests awaiting review, your open PRs, and assigned issues."
        configured={config.githubConfigured}
      >
        <Field
          label="Personal Access Token"
          id="githubToken"
          type="password"
          value={form.githubToken || ''}
          placeholder={config.githubConfigured ? '••••••••••••' : 'ghp_...'}
          onChange={v => setField('githubToken', v)}
          hint="github.com/settings/tokens — scopes: repo, notifications, read:user"
        />
        <Field
          label="Base URL (optional)"
          id="githubBaseUrl"
          value={form.githubBaseUrl || ''}
          placeholder="https://github.yourcompany.com/api/v3"
          onChange={v => setField('githubBaseUrl', v)}
          hint="Leave blank for github.com. For GitHub Enterprise use your internal API URL."
        />
        <div className="flex items-center gap-3 mt-1">
          <TestButton source="github" url="/api/github" />
          <a
            href="https://github.com/settings/tokens"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
          >
            <ExternalLink size={11} /> Generate token
          </a>
        </div>
      </Section>

      {/* Save reminder */}
      <p className="text-xs text-gray-400 text-center pb-4">
        Settings are stored locally in <code className="font-mono bg-gray-100 px-1 rounded">backend/config.json</code> and never sent anywhere.
      </p>
    </div>
  );
}
