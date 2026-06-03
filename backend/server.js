import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import jiraRouter from './routes/jira.js';
import gmailRouter from './routes/gmail.js';
import calendarRouter from './routes/calendar.js';
import slackRouter from './routes/slack.js';
import pasteRouter from './routes/paste.js';
import persistenceRouter from './routes/persistence.js';
import githubRouter from './routes/github.js';
import { loadOrCreateToken } from './auth.js';
import { encryptConfig, decryptConfig } from './crypto-utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, 'config.json');

const app = express();
const PORT = 3001;

// Load or generate auth token at startup
const AUTH_TOKEN = loadOrCreateToken();

app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:3001'], credentials: true }));
app.use(express.json());
app.use(cookieParser());

// --- Auth middleware for all /api/* routes ---
app.use('/api', (req, res, next) => {
  const sessionCookie = req.cookies && req.cookies.fb_session;
  if (!sessionCookie || sessionCookie !== AUTH_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

// Serve built frontend static files — set auth cookie so visiting the app grants access
const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
app.get('/', (req, res) => {
  res.cookie('fb_session', AUTH_TOKEN, { httpOnly: true, sameSite: 'strict' });
  res.sendFile(path.join(frontendDist, 'index.html'));
});
app.use(express.static(frontendDist));

// --- Config helpers ---
function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) return {};
  try {
    const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    if (raw.encrypted === true) {
      try {
        return decryptConfig(raw);
      } catch {
        return {};
      }
    }
    // Plain JSON — re-save as encrypted for future reads
    const encrypted = encryptConfig(raw);
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(encrypted, null, 2), 'utf8');
    return raw;
  } catch {
    return {};
  }
}

function saveConfig(data) {
  const encrypted = encryptConfig(data);
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(encrypted, null, 2), 'utf8');
}

// Attach config loader to every request
app.use((req, _res, next) => {
  req.getConfig = loadConfig;
  next();
});

// --- Config routes ---
app.get('/api/config', (req, res) => {
  const cfg = loadConfig();
  // Mask secrets — return only whether they're set
  res.json({
    jiraUrl: cfg.jiraUrl || '',
    jiraEmail: cfg.jiraEmail || '',
    jiraToken: cfg.jiraToken ? '***' : '',
    googleClientId: cfg.googleClientId || '',
    googleClientSecret: cfg.googleClientSecret ? '***' : '',
    googleAccessToken: cfg.googleAccessToken ? '***' : '',
    googleRefreshToken: cfg.googleRefreshToken ? '***' : '',
    slackToken: cfg.slackToken ? '***' : '',
    anthropicKey: cfg.anthropicKey ? '***' : '',
    anthropicBaseUrl: cfg.anthropicBaseUrl || '',
    // status flags
    jiraJql: cfg.jiraJql || '',
    jiraConfigured: !!(cfg.jiraUrl && cfg.jiraEmail && cfg.jiraToken),
    googleConfigured: !!(cfg.googleClientId && cfg.googleClientSecret && cfg.googleAccessToken),
    slackConfigured: !!cfg.slackToken,
    anthropicConfigured: !!cfg.anthropicKey,
    githubToken: cfg.githubToken ? '***' : '',
    githubBaseUrl: cfg.githubBaseUrl || '',
    githubConfigured: !!cfg.githubToken,
  });
});

app.post('/api/config', (req, res) => {
  const existing = loadConfig();
  const incoming = req.body;

  // Only update fields that are provided and not the placeholder '***'
  const merged = { ...existing };
  const fields = [
    'jiraUrl', 'jiraEmail', 'jiraToken', 'jiraJql',
    'googleClientId', 'googleClientSecret',
    'slackToken', 'anthropicKey', 'anthropicBaseUrl',
    'githubToken', 'githubBaseUrl',
  ];
  for (const field of fields) {
    if (incoming[field] !== undefined && incoming[field] !== '***' && incoming[field] !== '') {
      merged[field] = incoming[field];
    }
  }
  saveConfig(merged);
  res.json({ success: true });
});

// --- Google OAuth flow ---
app.get('/auth/google', (req, res) => {
  const cfg = loadConfig();
  if (!cfg.googleClientId || !cfg.googleClientSecret) {
    return res.status(400).json({ error: 'Google OAuth credentials not configured' });
  }
  const params = new URLSearchParams({
    client_id: cfg.googleClientId,
    redirect_uri: 'http://localhost:3001/auth/google/callback',
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/calendar.readonly',
    access_type: 'offline',
    prompt: 'consent',
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

app.get('/auth/google/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send('No code provided');

  const cfg = loadConfig();
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: cfg.googleClientId,
        client_secret: cfg.googleClientSecret,
        redirect_uri: 'http://localhost:3001/auth/google/callback',
        grant_type: 'authorization_code',
      }),
    });
    const tokens = await tokenRes.json();
    if (tokens.error) throw new Error(tokens.error_description || tokens.error);
    saveConfig({
      ...cfg,
      googleAccessToken: tokens.access_token,
      googleRefreshToken: tokens.refresh_token || cfg.googleRefreshToken,
    });
    res.send('<html><body><script>window.close();</script><p>Google connected! You can close this tab.</p></body></html>');
  } catch (err) {
    res.status(500).send(`OAuth error: ${err.message}`);
  }
});

// --- Temp debug: fetch all fields for a single Jira ticket ---
app.get('/api/jira-debug/:key', async (req, res) => {
  const cfg = loadConfig();
  const url = `${cfg.jiraUrl}/rest/api/2/issue/${req.params.key}`;
  const r = await fetch(url, { headers: { 'Authorization': `Bearer ${cfg.jiraToken}`, 'Accept': 'application/json' } });
  const data = await r.json();
  const nonNull = Object.entries(data.fields || {}).filter(([k,v]) => v !== null && v !== undefined).reduce((a,[k,v]) => ({...a,[k]:v}), {});
  res.json(nonNull);
});

// --- Integration routes ---
app.use('/api/jira', jiraRouter);
app.use('/api/gmail', gmailRouter);
app.use('/api/calendar', calendarRouter);
app.use('/api/slack', slackRouter);
app.use('/api/paste', pasteRouter);
app.use('/api/persistence', persistenceRouter);
app.use('/api/github', githubRouter);

// --- Sync all sources ---
app.get('/api/sync', async (req, res) => {
  const results = { tasks: [], errors: [] };

  const sources = [
    { name: 'jira', url: 'http://localhost:3001/api/jira' },
    { name: 'gmail', url: 'http://localhost:3001/api/gmail' },
    { name: 'calendar', url: 'http://localhost:3001/api/calendar' },
    { name: 'slack', url: 'http://localhost:3001/api/slack' },
    { name: 'github', url: 'http://localhost:3001/api/github' },
  ];

  await Promise.allSettled(
    sources.map(async (src) => {
      try {
        const r = await fetch(src.url);
        const data = await r.json();
        if (data.tasks) results.tasks.push(...data.tasks);
        if (data.error) results.errors.push({ source: src.name, error: data.error });
      } catch (err) {
        results.errors.push({ source: src.name, error: err.message });
      }
    })
  );

  res.json(results);
});

// Catch-all for SPA routing — must be after all API routes
app.get('*', (req, res) => {
  res.cookie('fb_session', AUTH_TOKEN, { httpOnly: true, sameSite: 'strict' });
  res.sendFile(path.join(frontendDist, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`FocusBoard backend running on http://localhost:${PORT}`);
  if (!fs.existsSync(CONFIG_PATH)) {
    saveConfig({});
    console.log('Created empty config.json');
  }
});
