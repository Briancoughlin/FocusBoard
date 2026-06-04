import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { decryptConfig } from '../crypto-utils.js';
import { logger } from '../logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const STORE_PATH = path.join(DATA_DIR, 'slack-notifications.json');

function loadNotifications() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(STORE_PATH)) return [];
    return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
  } catch { return []; }
}

function saveNotifications(tasks) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(STORE_PATH, JSON.stringify(tasks, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to save slack notifications:', e.message);
  }
}

// Keep only last 7 days of notifications
function pruneOld(tasks) {
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return tasks.filter(t => new Date(t.updatedAt).getTime() > cutoff);
}

export function getPendingAndClear() {
  // Return all persisted notifications — don't clear, let frontend dismiss them
  return loadNotifications();
}

const router = express.Router();

router.post('/', (req, res) => {
  const { id, title = '', body = '', appName = 'Slack', launchUrl = '' } = req.body || {};

  if (typeof title !== 'string' || typeof body !== 'string') {
    return res.status(400).json({ error: 'title and body must be strings' });
  }
  if (!title && !body) {
    return res.status(400).json({ error: 'title or body required' });
  }
  if (title.length > 500 || body.length > 5000) {
    return res.status(400).json({ error: 'title or body too long' });
  }

  // Load config to check channel map and workspace settings
  const CONFIG_PATH = path.join(__dirname, '..', 'config.json');
  let slackChannelMapEarly = {};
  try {
    const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    const cfg = raw.encrypted ? decryptConfig(raw) : raw;
    slackChannelMapEarly = cfg.slackChannelMap || {};
  } catch {}

  // Only allow notifications from mapped channels or DMs (non-channel messages)
  const isChannelMsg = title.startsWith('#');
  if (isChannelMsg) {
    const channelName = title.slice(1).split(':')[0].trim();
    if (!slackChannelMapEarly[channelName]) {
      logger.warn('Slack channel filtered', { channel: `#${channelName}`, reason: 'not in channel map' });
      return res.json({ task: null, ignored: true });
    }
  }

  const taskId = `slack-notif-${id || Date.now()}`;

  // Don't duplicate — check if we already have this notification
  const existing = loadNotifications();
  if (existing.find(t => t.id === taskId)) {
    return res.json({ task: null, duplicate: true });
  }

  const shortBody = body.slice(0, 80) + (body.length > 80 ? '…' : '');
  const taskTitle = body
    ? `${title}: ${shortBody}`
    : `Slack: ${title}`;

  // Build Slack URL — reuse already-loaded config
  let slackWorkspaceUrl = '';
  let teamId = '';
  let slackChannelMap = slackChannelMapEarly;
  try {
    const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    const cfg = raw.encrypted ? decryptConfig(raw) : raw;
    slackWorkspaceUrl = cfg.slackWorkspaceUrl || '';
    teamId = cfg.slackTeamId || '';
    slackChannelMap = cfg.slackChannelMap || {};
  } catch {}

  // Extract channel/sender from title
  const isChannel = title.startsWith('#');
  const channelName = isChannel ? title.slice(1).split(':')[0].trim() : title.split(':')[0].trim();

  // Look up channel ID from the map for deep-link support
  const channelId = isChannel ? (slackChannelMap[channelName] || '') : '';

  // Build the best URL available:
  //   1. slack:// deep link (if we have teamId + channelId)
  //   2. Workspace web URL (if configured)
  //   3. Generic slack://open fallback
  let url = 'slack://open';
  if (teamId && channelId) {
    url = `slack://channel?team=${teamId}&id=${channelId}`;
  } else if (slackWorkspaceUrl) {
    const base = slackWorkspaceUrl.replace(/\/$/, '');
    url = isChannel
      ? `${base}/messages/${channelName}`
      : `${base}/messages/@${channelName.toLowerCase().replace(/\s+/g, '.')}`;
  }

  const task = {
    id: taskId,
    sourceId: taskId,
    source: 'slack',
    title: taskTitle,
    description: body,
    priority: 'high',
    status: 'todo',
    updatedAt: new Date().toISOString(),
    url,
    appName,
    originalTitle: title,
  };

  const updated = pruneOld([...existing, task]);
  saveNotifications(updated);

  logger.info('Slack notification received', { id: taskId, channel: isChannelMsg ? title.split(':')[0] : 'dm', saved: updated.length });
  res.json({ task });
});

export default router;
