/**
 * @file server.js
 * Express application entry point for the FocusBoard backend.
 *
 * Responsibilities:
 *  - Cookie-based auth middleware that auto-grants localhost access
 *  - Encrypted config storage (read/write with transparent migration from plain JSON)
 *  - Google OAuth flow (authorize + callback)
 *  - Routing to all integration sub-routers (Jira, Gmail, GitHub, Slack, etc.)
 *  - /api/sync fan-out that aggregates tasks from every source in parallel
 *  - Static file serving with SPA catch-all for the built frontend
 */

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import jiraRouter from './routes/jira.js';
import jiraCreateRouter from './routes/jira-create.js';
import gmailRouter from './routes/gmail.js';
import calendarRouter from './routes/calendar.js';
import slackRouter from './routes/slack.js';
import pasteRouter from './routes/paste.js';
import persistenceRouter from './routes/persistence.js';
import githubRouter from './routes/github.js';
import themeRouter from './routes/theme.js';
import slackNotificationRouter, { getPendingAndClear } from './routes/slack-notification.js';
import reportRouter from './routes/report.js';
import updateRouter from './routes/update.js';
import bugReportRouter from './routes/bug-report.js';
import cacheRouter from './routes/cache.js';
import { loadOrCreateToken } from './auth.js';
import { encryptConfig, decryptConfig } from './crypto-utils.js';
import { logger } from './logger.js';
import { printBanner, printIntegrationStatus, printWarning, printReady, printRetrying, printCrash, printInfo } from './startup.js';

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
// FocusBoard is a single-user local app. The auth model is intentionally simple:
// any request from localhost is trusted (the machine owner is always the user).
// Remote requests — e.g. if someone port-forwards the server — require the
// session cookie that was set when the browser first visited the frontend.
app.use('/api', (req, res, next) => {
  const isLocalhost = req.socket.remoteAddress === '::1' ||
    req.socket.remoteAddress === '127.0.0.1' ||
    req.socket.remoteAddress === '::ffff:127.0.0.1';

  const sessionCookie = req.cookies && req.cookies.fb_session;
  if (!sessionCookie || sessionCookie !== AUTH_TOKEN) {
    if (isLocalhost) {
      // Auto-grant and refresh the cookie so the frontend always has a valid one
      res.cookie('fb_session', AUTH_TOKEN, { httpOnly: true, sameSite: 'lax' });
      return next();
    }
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

// Serve built frontend static files — set auth cookie so visiting the app grants access
// Docker copies the built frontend to public-dist/ alongside server.js.
// Native installs find it at ../frontend/dist relative to this file.
const frontendDist = fs.existsSync(path.join(__dirname, 'public-dist'))
  ? path.join(__dirname, 'public-dist')
  : path.join(__dirname, '..', 'frontend', 'dist');
const cookieOpts = { httpOnly: true, sameSite: 'lax' };

app.get('/', (req, res) => {
  res.cookie('fb_session', AUTH_TOKEN, cookieOpts);
  res.sendFile(path.join(frontendDist, 'index.html'));
});
app.use(express.static(frontendDist));

// --- Config helpers ---

/**
 * Read config.json and return a plain JS object with decrypted values.
 *
 * Migration path: if the file is unencrypted (no `encrypted: true` flag) it is
 * re-saved in encrypted form immediately, so credentials are only stored in
 * plain text for a single boot at most.
 *
 * @returns {Record<string, any>} Decrypted config, or {} if missing/corrupt.
 */
function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) return {};
  try {
    const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    if (raw.encrypted === true) {
      try {
        return decryptConfig(raw);
      } catch (decryptErr) {
        console.error('Config decrypt error:', decryptErr.message);
        return {};
      }
    }
    // Plain JSON on disk — encrypt now and return the plain values for this request
    const encrypted = encryptConfig(raw);
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(encrypted, null, 2), 'utf8');
    return raw;
  } catch {
    return {};
  }
}

/**
 * Encrypt `data` and atomically overwrite config.json.
 * Always encrypts — never writes credentials in plain text.
 *
 * @param {Record<string, any>} data - Decrypted config values to persist.
 */
function saveConfig(data) {
  const encrypted = encryptConfig(data);
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(encrypted, null, 2), 'utf8');
}

// Attach config loader to every request
app.use((req, _res, next) => {
  req.getConfig = loadConfig;
  next();
});

// Performance monitoring — log any API request taking over 2 seconds
const SLOW_THRESHOLD_MS = 2000;
app.use('/api', (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (duration > SLOW_THRESHOLD_MS) {
      logger.warn('Slow API call detected', {
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration_ms: duration,
      });
    } else if (!req.path.startsWith('/theme-')) {
      // Skip debug logging for theme polling (every 5s) — too noisy
      logger.debug('API call', { method: req.method, path: req.path, status: res.statusCode, duration_ms: duration });
    }
  });
  next();
});

// --- Watcher heartbeat state (in-memory, resets on server restart) ---
let watcherLastSeen = null;

// POST /api/health/watcher/ping — called by notification-watcher.js every poll cycle
app.post('/api/health/watcher/ping', (req, res) => {
  watcherLastSeen = new Date().toISOString();
  res.json({ ok: true });
});

// GET /api/health/watcher — frontend polls this to check watcher liveness
app.get('/api/health/watcher', (req, res) => {
  if (!watcherLastSeen) {
    return res.json({ alive: false, lastSeen: null, secondsAgo: null });
  }
  const secondsAgo = Math.round((Date.now() - new Date(watcherLastSeen).getTime()) / 1000);
  res.json({ alive: true, lastSeen: watcherLastSeen, secondsAgo });
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
    slackWorkspaceUrl: cfg.slackWorkspaceUrl || '',
    slackTeamId: cfg.slackTeamId || '',
    slackChannelMap: cfg.slackChannelMap || {},
    anthropicKey: cfg.anthropicKey ? '***' : '',
    anthropicBaseUrl: cfg.anthropicBaseUrl || '',
    // status flags
    jiraJql: cfg.jiraJql || '',
    jiraConfigured: !!(cfg.jiraUrl && cfg.jiraEmail && cfg.jiraToken),
    googleConfigured: !!(cfg.googleClientId && cfg.googleClientSecret && cfg.googleAccessToken),
    slackConfigured: !!(cfg.slackToken || cfg.slackWorkspaceUrl),
    anthropicConfigured: !!cfg.anthropicKey,
    githubToken: cfg.githubToken ? '***' : '',
    githubBaseUrl: cfg.githubBaseUrl || '',
    githubConfigured: !!cfg.githubToken,
    apiCutoffDate: cfg.apiCutoffDate || '',
    features: {
      jira:           cfg.features?.jira           ?? true,
      gmail:          cfg.features?.gmail          ?? true,
      calendar:       cfg.features?.calendar       ?? true,
      slack:          cfg.features?.slack          ?? true,
      github:         cfg.features?.github         ?? true,
      aiDigest:       cfg.features?.aiDigest       ?? true,
      weeklyReport:   cfg.features?.weeklyReport   ?? true,
      notifications:  cfg.features?.notifications  ?? true,
    },
  });
});

app.post('/api/config', (req, res) => {
  const existing = loadConfig();
  const incoming = req.body;

  // Merge only the allowlisted scalar fields. Skip '***' (the placeholder the
  // frontend sends back for already-stored secrets it can't read) and empty strings.
  const merged = { ...existing };
  const fields = [
    'jiraUrl', 'jiraEmail', 'jiraToken', 'jiraJql', 'defaultJiraProject',
    'googleClientId', 'googleClientSecret',
    'slackToken', 'slackWorkspaceUrl', 'slackTeamId', 'anthropicKey', 'anthropicBaseUrl',
    'githubToken', 'githubBaseUrl',
  ];
  for (const field of fields) {
    const val = incoming[field];
    if (val !== undefined && val !== '***' && val !== '') {
      if (typeof val !== 'string' || val.length > 2000) continue;
      merged[field] = val;
    }
  }

  // apiCutoffDate can be explicitly cleared to empty string (unlike secrets, which use '' to mean "no change")
  if (incoming.apiCutoffDate !== undefined && incoming.apiCutoffDate !== '***') {
    if (incoming.apiCutoffDate === '' || /^\d{4}-\d{2}-\d{2}$/.test(incoming.apiCutoffDate)) {
      merged.apiCutoffDate = incoming.apiCutoffDate;
    }
  }

  // slackChannelMap is an object (channel-name → channel-id) rather than a
  // scalar string, so it can't go through the loop above. It is never masked
  // with '***' because channel IDs are not sensitive credentials.
  if (incoming.slackChannelMap !== undefined && typeof incoming.slackChannelMap === 'object' && incoming.slackChannelMap !== null) {
    merged.slackChannelMap = incoming.slackChannelMap;
  }

  // Feature toggles — object of { sourceKey: boolean }
  if (incoming.features !== undefined && typeof incoming.features === 'object' && incoming.features !== null) {
    const allowed = ['jira', 'gmail', 'calendar', 'slack', 'github', 'aiDigest', 'weeklyReport', 'notifications'];
    const cleaned = {};
    for (const key of allowed) {
      if (typeof incoming.features[key] === 'boolean') cleaned[key] = incoming.features[key];
    }
    merged.features = { ...(existing.features || {}), ...cleaned };
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


// --- Integration routes ---
app.use('/api/jira', jiraRouter);
app.use('/api/jira', jiraCreateRouter);
app.use('/api/gmail', gmailRouter);
app.use('/api/calendar', calendarRouter);
app.use('/api/slack', slackRouter);
app.use('/api/paste', pasteRouter);
app.use('/api/persistence', persistenceRouter);
app.use('/api/github', githubRouter);
app.use('/api/theme', themeRouter);
app.use('/api/slack-notification', slackNotificationRouter);
app.use('/api/report', reportRouter);
app.use('/api/update', updateRouter);
app.use('/api/bug-report', bugReportRouter);
app.use('/api/cache', cacheRouter);

// --- Pending notification tasks ---
app.get('/api/slack-notifications/pending', (req, res) => {
  const tasks = getPendingAndClear();
  res.json({ tasks });
});

// --- Sync all sources ---
// Fan-out: hit every integration endpoint in parallel and merge their tasks into
// one response. Promise.allSettled is used so a single failing source (e.g. Jira
// is unreachable) does not abort the others — the error is collected separately
// and the frontend can surface it per-source without losing the rest of the data.
app.get('/api/sync', async (req, res) => {
  const results = { tasks: [], errors: [] };
  const syncDone = logger.time('Sync complete');

  const cfg = loadConfig();
  const features = cfg.features || {};

  logger.info('Sync started', {});

  const allSources = [
    { name: 'jira',     url: 'http://localhost:3001/api/jira' },
    { name: 'gmail',    url: 'http://localhost:3001/api/gmail' },
    { name: 'calendar', url: 'http://localhost:3001/api/calendar' },
    { name: 'slack',    url: 'http://localhost:3001/api/slack' },
    { name: 'github',   url: 'http://localhost:3001/api/github' },
  ];

  // Only include sources that haven't been explicitly disabled
  const sources = allSources.filter(s => features[s.name] !== false);

  const sourceCounts = {};

  await Promise.allSettled(
    sources.map(async (src) => {
      try {
        const r = await fetch(src.url);
        const data = await r.json();
        const count = data.tasks ? data.tasks.length : 0;
        sourceCounts[src.name] = count;
        if (data.tasks) results.tasks.push(...data.tasks);
        if (data.error) {
          results.errors.push({ source: src.name, error: data.error });
          logger.warn(`Sync source error`, { source: src.name, error: data.error });
        }
      } catch (err) {
        results.errors.push({ source: src.name, error: err.message });
        logger.error(`Sync source failed`, { source: src.name, error: err.message });
      }
    })
  );

  // Drain any tasks that arrived via the Windows Slack notification listener
  // (a separate process that captures toast notifications) and fold them in here.
  // getPendingAndClear() is destructive — tasks are consumed and won't be returned again.
  if (features.notifications !== false && features.slack !== false) {
    const notifTasks = getPendingAndClear();
    if (notifTasks.length > 0) results.tasks.push(...notifTasks);
  }

  syncDone({
    ...sourceCounts,
    total: results.tasks.length,
    errors: results.errors.length,
  });

  // Save to cache for fast startup
  try {
    const cacheData = JSON.stringify({ tasks: results.tasks, cachedAt: new Date().toISOString() });
    fs.writeFileSync(path.join(__dirname, 'data', 'task-cache.json'), cacheData, 'utf8');
    logger.info('Task cache updated', { taskCount: results.tasks.length });
  } catch {}

  res.json(results);
});

// Catch-all for SPA routing — must be after all API routes
app.get('*', (req, res) => {
  res.cookie('fb_session', AUTH_TOKEN, cookieOpts);
  res.sendFile(path.join(frontendDist, 'index.html'));
});

const server = app.listen(PORT, '127.0.0.1', () => {
  logger.info('FocusBoard starting', { port: PORT, node: process.version });

  if (!fs.existsSync(CONFIG_PATH)) {
    saveConfig({});
    logger.info('Created empty config.json', {});
  }

  // Config health check
  try {
    const cfg = loadConfig();
    const jiraOk    = !!(cfg.jiraUrl && cfg.jiraToken);
    const googleOk  = !!(cfg.googleClientId && cfg.googleAccessToken);
    const githubOk  = !!cfg.githubToken;
    const anthropicOk = !!cfg.anthropicKey;
    const slackOk   = !!(cfg.slackToken || cfg.slackWorkspaceUrl);
    const features  = cfg.features || {};

    // Friendly terminal output
    printBanner(PORT, process.version);
    printIntegrationStatus({ jira: jiraOk, google: googleOk, github: githubOk, anthropic: anthropicOk, slack: slackOk, features });

    // Actionable warnings for common misconfigs
    if (cfg.jiraUrl && !cfg.jiraToken) {
      printWarning('Jira URL is set but token is missing — open Settings to add your PAT');
      logger.warn('Jira URL is set but jiraToken is missing', {});
    }
    if (cfg.googleClientId && !cfg.googleAccessToken) {
      printWarning('Google not authorised — open Settings and click "Connect Google Account"');
      logger.warn('Google client ID set but no access token', {});
    }
    if (!cfg.anthropicKey) {
      printInfo('Claude AI not configured — Gmail action extraction and Quick Add AI will be unavailable');
      logger.info('anthropicKey not set', {});
    }

    printReady();
    logger.info('Config health', { jira: jiraOk, google: googleOk, github: githubOk, anthropic: anthropicOk, slack: slackOk });
  } catch (err) {
    printWarning(`Could not read config: ${err.message}`);
    logger.warn('Could not read config for health check', { error: err.message });
  }
});

// Handle port-in-use errors gracefully — the most common crash cause.
// When the scheduled task restarts after a crash, the previous process may
// still be holding port 3001. We wait 3 seconds and retry once before giving up.
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    printRetrying(PORT, 3);
    logger.error(`Port ${PORT} already in use — retrying`, { port: PORT });
    setTimeout(() => {
      server.close();
      app.listen(PORT, '127.0.0.1', () => {
        printReady();
        logger.info('FocusBoard backend running (retry)', { port: PORT });
      });
    }, 3000);
  } else if (err.code === 'ECONNRESET' || err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
    logger.warn('Network error on server socket — continuing', { code: err.code, error: err.message });
  } else {
    printCrash(err);
    logger.error('Server error', { code: err.code, error: err.message });
  }
});

// Catch unhandled promise rejections so they don't silently kill the process
process.on('unhandledRejection', (reason) => {
  const err = reason instanceof Error ? reason : new Error(String(reason));
  printCrash(err);
  logger.error('Unhandled promise rejection', { error: err.message, stack: err.stack });
});

// Catch uncaught exceptions — log and keep running if possible
process.on('uncaughtException', (err) => {
  printCrash(err);
  logger.error('Uncaught exception', { error: err.message, stack: err.stack });
});
