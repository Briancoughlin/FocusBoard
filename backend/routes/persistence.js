import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');

const ALLOWED_KEYS = [
  'overrides',
  'pasted-tasks',
  'dismissed',
  'done-dates',
  'completed-today',
  'digest-date',
  'inbox-read',
  'split-percent',
  'theme-auto',
  'theme-accent',
  'theme-dark',
  'due-date-overrides',
  'injected-tasks',
];

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function filePath(key) {
  return path.join(DATA_DIR, `${key}.json`);
}

const router = express.Router();

router.get('/:key', (req, res) => {
  const { key } = req.params;
  if (!ALLOWED_KEYS.includes(key)) {
    return res.status(400).json({ error: 'Unknown key' });
  }
  ensureDataDir();
  const fp = filePath(key);
  if (!fs.existsSync(fp)) {
    return res.json({ value: null });
  }
  try {
    const raw = fs.readFileSync(fp, 'utf8');
    const parsed = JSON.parse(raw);
    return res.json({ value: parsed });
  } catch {
    return res.json({ value: null });
  }
});

router.post('/:key', (req, res) => {
  const { key } = req.params;
  if (!ALLOWED_KEYS.includes(key)) {
    return res.status(400).json({ error: 'Unknown key' });
  }
  ensureDataDir();
  const { value } = req.body;
  try {
    fs.writeFileSync(filePath(key), JSON.stringify(value, null, 2), 'utf8');
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
