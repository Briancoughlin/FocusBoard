/**
 * @file cache.js
 * Simple task cache routes — persist the last sync result to disk so the
 * frontend can load tasks instantly on startup without waiting for a full sync.
 *
 * GET  /api/cache  — returns { tasks: Task[] } from backend/data/task-cache.json,
 *                    or { tasks: [] } if the file is missing or unreadable.
 * POST /api/cache  — saves { tasks: Task[] } to backend/data/task-cache.json.
 */

import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_PATH = path.join(__dirname, '..', 'data', 'task-cache.json');

const router = express.Router();

// GET /api/cache
router.get('/', (req, res) => {
  try {
    if (!fs.existsSync(CACHE_PATH)) {
      return res.json({ tasks: [] });
    }
    const raw = fs.readFileSync(CACHE_PATH, 'utf8');
    const data = JSON.parse(raw);
    return res.json({ tasks: data.tasks || [] });
  } catch {
    return res.json({ tasks: [] });
  }
});

// POST /api/cache
router.post('/', (req, res) => {
  try {
    const { tasks } = req.body;
    if (!Array.isArray(tasks)) {
      return res.status(400).json({ error: 'tasks must be an array' });
    }
    const cacheData = JSON.stringify({ tasks, cachedAt: new Date().toISOString() });
    fs.writeFileSync(CACHE_PATH, cacheData, 'utf8');
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
