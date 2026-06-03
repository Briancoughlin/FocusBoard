// In-memory store for pending notification tasks
// server.js imports this module and uses pendingTasks + getPendingAndClear()
export const pendingTasks = [];

export function getPendingAndClear() {
  const tasks = pendingTasks.splice(0, pendingTasks.length);
  return tasks;
}

import express from 'express';
const router = express.Router();

// POST /api/slack-notification
// Body: { id, title, body, appName }
router.post('/', (req, res) => {
  const { id, title = '', body = '', appName = 'Slack' } = req.body || {};

  if (!title && !body) {
    return res.status(400).json({ error: 'title or body required' });
  }

  const shortBody = body.slice(0, 60) + (body.length > 60 ? '…' : '');
  const taskTitle = `Reply to ${title || appName}: ${shortBody}`;

  const task = {
    id: `slack-notif-${id || Date.now()}-${Date.now()}`,
    source: 'slack',
    title: taskTitle,
    description: body,
    priority: 'high',
    status: 'todo',
    createdAt: new Date().toISOString(),
    appName,
    originalTitle: title,
  };

  pendingTasks.push(task);

  console.log(`[slack-notification] Queued task: ${task.title}`);
  res.json({ task });
});

export default router;
