import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, ExternalLink, Save, TestTube, Loader2 } from 'lucide-react';
import type { Config } from '../types';
import { getConfig, saveConfig, getGoogleAuthUrl } from '../services/api';
import { getPersistedValue, setPersistedValue } from '../services/persistence';
import { fetchWindowsTheme, applyTheme } from '../services/theme';

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

interface ChannelRow {
  name: string;
  id: string;
}

const DEFAULT_FEATURES = {
  jira: true, gmail: true, calendar: true, slack: true,
  github: true, aiDigest: true, weeklyReport: true, notifications: true,
};

function TestButton({ source, url, testStates, testMessages, onTest }: {
  source: string; url: string;
  testStates: Record<string, TestState>;
  testMessages: Record<string, string>;
  onTest: (source: string, url: string) => void;
}) {
  const state = testStates[source] || 'idle';
  const msg = testMessages[source];
  return (
    <div>
      <button onClick={() => onTest(source, url)} disabled={state === 'testing'} className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors">
        {state === 'testing' ? <Loader2 size={14} className="animate-spin" /> : <TestTube size={14} />}
        Test Connection
      </button>
      {msg && <p className={`text-xs mt-1 ${state === 'ok' ? 'text-emerald-600' : 'text-red-500'}`}>{msg}</p>}
    </div>
  );
}

function Toggle({ featureKey, features, setFeatures, setIsDirty }: {
  featureKey: keyof typeof DEFAULT_FEATURES;
  features: typeof DEFAULT_FEATURES;
  setFeatures: React.Dispatch<React.SetStateAction<typeof DEFAULT_FEATURES>>;
  setIsDirty: (v: boolean) => void;
}) {
  const enabled = features[featureKey] ?? true;
  return (
    <button
      role="switch"
      aria-checked={enabled}
      aria-label={`${enabled ? 'Disable' : 'Enable'} ${featureKey}`}
      onClick={e => { e.stopPropagation(); setFeatures(f => ({ ...f, [featureKey]: !enabled })); setIsDirty(true); }}
      className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none flex-shrink-0"
      style={{ backgroundColor: enabled ? 'var(--accent)' : '#d1d5db' }}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );
}

function IntegrationSection({ featureKey, icon, title, description, configured, features, setFeatures, setIsDirty, children }: {
  featureKey: keyof typeof DEFAULT_FEATURES;
  icon: string;
  title: string;
  description: string;
  configured?: boolean;
  features: typeof DEFAULT_FEATURES;
  setFeatures: React.Dispatch<React.SetStateAction<typeof DEFAULT_FEATURES>>;
  setIsDirty: (v: boolean) => void;
  children: React.ReactNode;
}) {
  const enabled = features[featureKey] ?? true;
  const [hovered, setHovered] = React.useState(false);
  const expanded = hovered;

  return (
    <div
      className="rounded-xl border shadow-sm overflow-hidden transition-all"
      style={{
        borderColor: expanded ? 'var(--accent)' : enabled ? 'var(--border)' : 'var(--border)',
        backgroundColor: 'var(--bg-card)',
        opacity: enabled ? 1 : 0.65,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Header — always visible */}
      <div
        className="flex items-center justify-between px-6 py-4 transition-all"
        style={{ borderBottom: expanded && enabled ? '1px solid var(--border)' : 'none' }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-2xl flex-shrink-0">{icon}</span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>{title}</h3>
              {configured !== undefined && <StatusIcon configured={configured} />}
            </div>
            {expanded && <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>{description}</p>}
          </div>
        </div>
        <Toggle featureKey={featureKey} features={features} setFeatures={setFeatures} setIsDirty={setIsDirty} />
      </div>

      {/* Body — shown on hover */}
      {expanded && (
        enabled
          ? <div className="px-6 py-5">{children}</div>
          : <div className="px-6 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
              Disabled — skipped during sync. Your credentials and settings are preserved.
            </div>
      )}
    </div>
  );
}

interface SettingsPageProps {
  onDirtyChange?: (dirty: boolean) => void;
}

export function SettingsPage({ onDirtyChange }: SettingsPageProps = {}) {
  const [subTab, setSubTab] = useState<'integrations' | 'app'>('integrations');
  const [config, setConfig] = useState<Config>({});
  const [form, setForm] = useState<Record<string, string>>({});
  const [channelMapRows, setChannelMapRows] = useState<ChannelRow[]>([]);
  const [features, setFeatures] = useState<typeof DEFAULT_FEATURES>({ ...DEFAULT_FEATURES });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);
  const [testStates, setTestStates] = useState<Record<string, TestState>>({});
  const [testMessages, setTestMessages] = useState<Record<string, string>>({});

  // Theme state
  const [themeAuto, setThemeAuto] = useState(true);
  const [themeAccent, setThemeAccent] = useState('#0078d4');
  const [themeDark, setThemeDark] = useState(false);

  // Load theme preferences
  useEffect(() => {
    Promise.all([
      getPersistedValue<boolean>('theme-auto', true),
      getPersistedValue<string | null>('theme-accent', null),
      getPersistedValue<boolean | null>('theme-dark', null),
    ]).then(async ([auto, accent, dark]) => {
      setThemeAuto(auto);
      if (accent) setThemeAccent(accent);
      if (dark !== null) setThemeDark(dark);
      // If no manual accent saved yet, pre-fill with current Windows accent
      if (!accent) {
        const wt = await fetchWindowsTheme();
        setThemeAccent(wt.accentColor);
        setThemeDark(wt.isDark);
      }
    });
  }, []);

  useEffect(() => {
    getConfig().then(cfg => {
      setConfig(cfg);
      // Pre-fill non-secret fields
      setForm({
        jiraUrl: cfg.jiraUrl || '',
        jiraEmail: cfg.jiraEmail || '',
        jiraToken: '',
        jiraJql: cfg.jiraJql || '',
        defaultJiraProject: (cfg as Record<string, string>).defaultJiraProject || '',
        googleClientId: cfg.googleClientId || '',
        googleClientSecret: '',
        slackToken: '',
        slackWorkspaceUrl: cfg.slackWorkspaceUrl || '',
        slackTeamId: cfg.slackTeamId || '',
        githubToken: '',
        githubBaseUrl: cfg.githubBaseUrl || '',
        anthropicKey: '',
        anthropicBaseUrl: cfg.anthropicBaseUrl || '',
        apiCutoffDate: (cfg as Record<string, string>).apiCutoffDate || '',
      });
      // Populate channel map rows from saved config
      const map = cfg.slackChannelMap || {};
      setChannelMapRows(Object.entries(map).map(([name, id]) => ({ name, id })));
      // Load feature toggles (default all on)
      if (cfg.features) {
        setFeatures({ ...DEFAULT_FEATURES, ...cfg.features });
      }
    });
  }, []);

  const setField = (key: string, value: string) => {
    setForm(f => ({ ...f, [key]: value }));
    setIsDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Build slackChannelMap object from rows (skip rows with empty name)
      const slackChannelMap: Record<string, string> = {};
      for (const row of channelMapRows) {
        const name = row.name.trim();
        if (name) slackChannelMap[name] = row.id.trim();
      }
      await saveConfig({ ...form, slackChannelMap, features } as unknown as Partial<Config>);
      setSaved(true);
      setIsDirty(false);
      setTimeout(() => setSaved(false), 2500);
      const updated = await getConfig();
      setConfig(updated);
      const map = updated.slackChannelMap || {};
      setChannelMapRows(Object.entries(map).map(([name, id]) => ({ name, id })));
      if (updated.features) setFeatures({ ...DEFAULT_FEATURES, ...updated.features });
    } catch {
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
    } catch (err: unknown) {
      setTestStates(s => ({ ...s, [source]: 'error' }));
      setTestMessages(m => ({ ...m, [source]: err instanceof Error ? err.message : String(err) }));
    }
  };

  const openGoogleAuth = () => {
    window.open(getGoogleAuthUrl(), '_blank', 'width=600,height=700');
  };

  const handleThemeAutoChange = async (auto: boolean) => {
    setThemeAuto(auto);
    await setPersistedValue('theme-auto', auto);
    if (auto) {
      const wt = await fetchWindowsTheme();
      applyTheme(wt.accentColor, wt.isDark);
    } else {
      applyTheme(themeAccent, themeDark);
    }
  };

  const handleThemeAccentChange = async (accent: string) => {
    setThemeAccent(accent);
    await setPersistedValue('theme-accent', accent);
    if (!themeAuto) applyTheme(accent, themeDark);
  };

  const handleThemeDarkChange = async (dark: boolean) => {
    setThemeDark(dark);
    await setPersistedValue('theme-dark', dark);
    if (!themeAuto) applyTheme(themeAccent, dark);
  };


  return (
    <div className="max-w-2xl mx-auto py-8 px-4 overflow-y-auto h-full">

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Settings</h1>
        <button
          onClick={handleSave}
          disabled={saving}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all shadow-sm ${
            saved ? 'bg-emerald-500 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'
          } disabled:opacity-50`}
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          {saved ? 'Saved!' : isDirty ? 'Save All *' : 'Save All'}
        </button>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 p-1 rounded-lg mb-6" style={{ backgroundColor: 'var(--bg)' }}>
        {([
          { key: 'integrations', label: '🔌 Integrations' },
          { key: 'app',          label: '🎛️ App Settings' },
        ] as { key: 'integrations' | 'app'; label: string }[]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setSubTab(tab.key)}
            role="tab"
            aria-selected={subTab === tab.key}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${subTab === tab.key ? 'shadow-sm text-white' : ''}`}
            style={subTab === tab.key ? { backgroundColor: 'var(--accent)' } : { color: 'var(--text-secondary)' }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ══ INTEGRATIONS TAB ══════════════════════════════════════ */}
      {subTab === 'integrations' && <div className="space-y-6">

      <IntegrationSection featureKey="jira" icon="🟦" title="Jira" description="Fetch issues assigned to you." configured={config.jiraConfigured} features={features} setFeatures={setFeatures} setIsDirty={setIsDirty}>
        <Field label="Jira Base URL" id="jiraUrl" value={form.jiraUrl || ''} placeholder="https://yourorg.atlassian.net" onChange={v => setField('jiraUrl', v)} />
        <Field label="Email" id="jiraEmail" type="email" value={form.jiraEmail || ''} placeholder="you@company.com" onChange={v => setField('jiraEmail', v)} />
        <Field label="Personal Access Token" id="jiraToken" type="password" value={form.jiraToken || ''} placeholder={config.jiraToken ? '••••••••••••' : 'Paste token...'} onChange={v => setField('jiraToken', v)} hint="Account Settings → Security → API tokens" />
        <Field label="Default Project Key (optional)" id="defaultJiraProject" value={form.defaultJiraProject || ''} placeholder="e.g. CSD" onChange={v => setField('defaultJiraProject', v)} hint="Pre-selected when creating Jira tickets from FocusBoard" />
        <Field label="JQL Filter (optional)" id="jiraJql" value={form.jiraJql || ''} placeholder="assignee=currentUser() AND resolution=Unresolved ORDER BY updated DESC" onChange={v => setField('jiraJql', v)} hint="Paste your Jira filter JQL here" />
        <div className="flex items-center gap-3 mt-1">
          <TestButton source="jira" url="/api/jira" testStates={testStates} testMessages={testMessages} onTest={testConnection} />
          <a href="https://id.atlassian.com/manage-profile/security/api-tokens" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"><ExternalLink size={11} /> Create token</a>
        </div>
      </IntegrationSection>

      <IntegrationSection featureKey="gmail" icon="📧" title="Gmail & Calendar" description="Action items from email + meetings in week view." configured={config.googleConfigured} features={features} setFeatures={setFeatures} setIsDirty={setIsDirty}>
        <Field label="OAuth Client ID" id="googleClientId" value={form.googleClientId || ''} placeholder="123456789-abc.apps.googleusercontent.com" onChange={v => setField('googleClientId', v)} />
        <Field label="OAuth Client Secret" id="googleClientSecret" type="password" value={form.googleClientSecret || ''} placeholder={config.googleClientSecret ? '••••••••••••' : 'GOCSPX-...'} onChange={v => setField('googleClientSecret', v)} hint="Google Cloud Console → APIs & Services → Credentials" />
        <div className="flex flex-wrap items-center gap-3 mt-2">
          <button onClick={openGoogleAuth} disabled={!form.googleClientId && !config.googleClientId} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-40 shadow-sm transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Connect Google Account
          </button>
          {config.googleConfigured && <span className="flex items-center gap-1 text-sm text-emerald-600"><CheckCircle size={14} /> Connected</span>}
        </div>
        <div className="flex gap-3 mt-3">
          <TestButton source="gmail" url="/api/gmail" testStates={testStates} testMessages={testMessages} onTest={testConnection} />
          <TestButton source="calendar" url="/api/calendar" testStates={testStates} testMessages={testMessages} onTest={testConnection} />
        </div>
        <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-2"><ExternalLink size={11} /> Google Cloud Console</a>
      </IntegrationSection>

      <IntegrationSection featureKey="slack" icon="💬" title="Slack" description="DMs, mentions, and Windows toast notifications." configured={config.slackConfigured} features={features} setFeatures={setFeatures} setIsDirty={setIsDirty}>
        <Field label="Team ID" id="slackTeamId" value={form.slackTeamId || ''} placeholder="E016WLPF0G6" onChange={v => setField('slackTeamId', v)} hint="From your Slack URL: app.slack.com/client/TEAM_ID/..." />
        <Field label="Workspace URL" id="slackWorkspaceUrl" value={form.slackWorkspaceUrl || ''} placeholder="https://yourworkspace.slack.com" onChange={v => setField('slackWorkspaceUrl', v)} hint="Used to open channels directly from notifications." />
        <Field label="Bot Token (optional)" id="slackToken" type="password" value={form.slackToken || ''} placeholder={config.slackToken ? '••••••••••••' : 'xoxb-...'} onChange={v => setField('slackToken', v)} hint="api.slack.com/apps → OAuth & Permissions → Bot User OAuth Token" />
        <div className="flex items-center justify-between py-3 border-t mt-2" style={{ borderColor: 'var(--border)' }}>
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Windows Notifications</p>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Capture Slack toast notifications without a bot token</p>
          </div>
          <Toggle featureKey="notifications" features={features} setFeatures={setFeatures} setIsDirty={setIsDirty} />
        </div>
        <div className="flex items-center gap-3 mt-1">
          <TestButton source="slack" url="/api/slack" testStates={testStates} testMessages={testMessages} onTest={testConnection} />
          <a href="https://api.slack.com/apps" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"><ExternalLink size={11} /> Slack Apps</a>
        </div>
        <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
          <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Channel ID Map</p>
          <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>Maps channel names to IDs for deep-linking into Slack. Find the ID in: <code className="font-mono px-1 rounded" style={{ backgroundColor: 'var(--bg)' }}>app.slack.com/client/TEAM_ID/CHANNEL_ID</code></p>
          {channelMapRows.length > 0 && (
            <div className="mb-2 space-y-2">
              <div className="grid grid-cols-[1fr_1fr_auto] gap-2 text-xs font-medium px-1" style={{ color: 'var(--text-secondary)' }}><span>Channel Name</span><span>Channel ID</span><span /></div>
              {channelMapRows.map((row, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                  <input type="text" value={row.name} placeholder="ask-discussions" onChange={e => { setChannelMapRows(rows => rows.map((r, i) => i === idx ? { ...r, name: e.target.value } : r)); setIsDirty(true); }} className="px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" />
                  <input type="text" value={row.id} placeholder="C06AF9683" onChange={e => { setChannelMapRows(rows => rows.map((r, i) => i === idx ? { ...r, id: e.target.value } : r)); setIsDirty(true); }} className="px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 font-mono" />
                  <button onClick={() => { setChannelMapRows(rows => rows.filter((_, i) => i !== idx)); setIsDirty(true); }} className="text-gray-400 hover:text-red-500 transition-colors px-1" title="Remove" aria-label="Remove row">×</button>
                </div>
              ))}
            </div>
          )}
          <button onClick={() => { setChannelMapRows(rows => [...rows, { name: '', id: '' }]); setIsDirty(true); }} className="text-sm text-blue-600 hover:underline">+ Add channel</button>
        </div>
      </IntegrationSection>

      <IntegrationSection featureKey="github" icon="🐙" title="GitHub" description="PRs awaiting review, your open PRs, and CI notifications." configured={config.githubConfigured} features={features} setFeatures={setFeatures} setIsDirty={setIsDirty}>
        <Field label="Personal Access Token" id="githubToken" type="password" value={form.githubToken || ''} placeholder={config.githubConfigured ? '••••••••••••' : 'ghp_...'} onChange={v => setField('githubToken', v)} hint="github.com/settings/tokens — scopes: repo, notifications, read:user" />
        <Field label="Base URL (optional)" id="githubBaseUrl" value={form.githubBaseUrl || ''} placeholder="https://github.yourcompany.com/api/v3" onChange={v => setField('githubBaseUrl', v)} hint="Leave blank for github.com. For GitHub Enterprise use your internal API URL." />
        <div className="flex items-center gap-3 mt-1">
          <TestButton source="github" url="/api/github" testStates={testStates} testMessages={testMessages} onTest={testConnection} />
          <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"><ExternalLink size={11} /> Generate token</a>
        </div>
      </IntegrationSection>

      <IntegrationSection featureKey="aiDigest" icon="🤖" title="Claude AI" description="Powers the daily digest, standup report, and email action items." configured={config.anthropicConfigured} features={features} setFeatures={setFeatures} setIsDirty={setIsDirty}>
        <div className="flex items-center justify-between pb-4 mb-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Weekly Standup Report</p>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>AI-generated report from completed tasks</p>
          </div>
          <Toggle featureKey="weeklyReport" features={features} setFeatures={setFeatures} setIsDirty={setIsDirty} />
        </div>
        <Field label="API Key" id="anthropicKey" type="password" value={form.anthropicKey || ''} placeholder={config.anthropicConfigured ? '••••••••••••' : 'sk-ant-...'} onChange={v => setField('anthropicKey', v)} hint="Standard Anthropic key, or your U-AI token" />
        <Field label="Base URL (optional)" id="anthropicBaseUrl" value={form.anthropicBaseUrl || ''} placeholder="https://uai-litellm.internal.unity.com" onChange={v => setField('anthropicBaseUrl', v)} hint="Unity employees: use the U-AI gateway URL. Leave blank for standard Anthropic." />
        <a href="https://console.anthropic.com/account/keys" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"><ExternalLink size={11} /> Get API key</a>
      </IntegrationSection>

      {/* API Cutover lives here — it's integration-related */}
      <div className="rounded-xl border p-6 shadow-sm" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <h3 className="font-semibold text-base mb-1" style={{ color: 'var(--text-primary)' }}>API Cutover Date</h3>
        <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>When connecting a new API, set this to avoid importing weeks of old data.</p>
        <div className="flex items-center gap-2">
          <input id="apiCutoffDate" type="date" value={form.apiCutoffDate || ''} onChange={e => setField('apiCutoffDate', e.target.value)} className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }} />
          {form.apiCutoffDate && <button onClick={() => setField('apiCutoffDate', '')} className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>Clear</button>}
        </div>
        <p className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>Leave empty to fetch all history. When set, Gmail, Slack, and GitHub only return items after this date.</p>
      </div>

      <p className="text-xs text-gray-400 text-center pb-4">Settings stored in <code className="font-mono bg-gray-100 px-1 rounded">backend/config.json</code> — never sent anywhere.</p>
      </div>}

      {/* ══ APP SETTINGS TAB — appearance, api cutover, maintenance ══ */}
      {subTab === 'app' && <div className="space-y-6">

        {/* Appearance */}
        <div className="rounded-xl border p-6 shadow-sm" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <h3 className="font-semibold text-base mb-1" style={{ color: 'var(--text-primary)' }}>Appearance</h3>
          <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>Accent colour and dark mode follow your Windows settings automatically.</p>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Follow Windows theme</p>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Use your Windows accent colour and dark/light mode</p>
            </div>
            <button role="switch" aria-checked={themeAuto} onClick={() => handleThemeAutoChange(!themeAuto)} className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none" style={{ backgroundColor: themeAuto ? 'var(--accent)' : '#d1d5db' }}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${themeAuto ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
          {!themeAuto && (
            <div className="space-y-3 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium w-28" style={{ color: 'var(--text-primary)' }}>Accent colour</label>
                <input type="color" value={themeAccent} onChange={e => handleThemeAccentChange(e.target.value)} className="h-8 w-16 rounded cursor-pointer border" style={{ borderColor: 'var(--border)' }} />
                <span className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>{themeAccent}</span>
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Dark mode</label>
                <button role="switch" aria-checked={themeDark} onClick={() => handleThemeDarkChange(!themeDark)} className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none" style={{ backgroundColor: themeDark ? '#374151' : '#d1d5db' }}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${themeDark ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Maintenance */}
        <div className="rounded-xl border p-6 shadow-sm" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <h3 className="font-semibold text-base mb-1" style={{ color: 'var(--text-primary)' }}>Maintenance</h3>
          <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>If the app looks stale or Settings appears blank, clear the browser cache and reload fresh from the server.</p>
          <button
            onClick={async () => {
              try {
                if ('serviceWorker' in navigator) {
                  const regs = await navigator.serviceWorker.getRegistrations();
                  await Promise.all(regs.map(r => r.unregister()));
                }
                if ('caches' in window) {
                  const keys = await caches.keys();
                  await Promise.all(keys.map(k => caches.delete(k)));
                }
              } finally {
                window.location.reload();
              }
            }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border transition-all hover:bg-red-50 hover:border-red-300 hover:text-red-600"
            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
          >
            🔄 Clear cache &amp; reload
          </button>
        </div>

        <p className="text-xs text-gray-400 text-center pb-4">Settings stored in <code className="font-mono bg-gray-100 px-1 rounded">backend/config.json</code> — never sent anywhere.</p>
      </div>}

    </div>
  );
}
