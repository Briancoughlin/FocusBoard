import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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
  const { id, title = '', body = '', appName = 'Slack' } = req.body || {};

  if (!title && !body) {
    return res.status(400).json({ error: 'title or body required' });
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

  // Build a Slack deep link — opens the DM or channel search in Slack desktop app
  const isChannel = title.startsWith('#');
  const isDM = title && !isChannel;
  const slackUrl = isChannel
    ? `slack://channel?team=&id=` // channel name search fallback
    : `slack://open`; // opens Slack app directly

  const task = {
    id: taskId,
    sourceId: taskId,
    source: 'slack',
    title: taskTitle,
    description: body,
    priority: 'high',
    status: 'todo',
    updatedAt: new Date().toISOString(),
    url: 'slack://open', // always open Slack app on click
    appName,
    originalTitle: title,
  };

  const updated = pruneOld([...existing, task]);
  saveNotifications(updated);

  console.log(`[slack-notification] Saved: ${task.title}`);
  res.json({ task });
});

export default router;
