/**
 * @file routes/bug-report.js
 * Bug report route — collects recent server logs and creates a GitHub issue.
 *
 * POST /api/bug-report
 * Body: { description: string, userAgent: string }
 *
 * Reads the last 100 lines from today's log file (falls back to yesterday's if
 * today's is empty or missing), then creates a GitHub issue in
 * Briancoughlin/FocusBoard with the `bug` label.
 */

import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { decryptConfig } from '../crypto-utils.js';
import { logger } from '../logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, '..', 'config.json');
const LOGS_DIR = path.join(__dirname, '..', 'logs');
const REPO = 'Briancoughlin/FocusBoard';

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) return {};
  try {
    const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    if (raw.encrypted === true) return decryptConfig(raw);
    return raw;
  } catch { return {}; }
}

/**
 * Return the log file path for a given date offset from today (UTC).
 * offset=0 → today, offset=-1 → yesterday.
 */
function logPathForOffset(offset = 0) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return path.join(LOGS_DIR, `server-${yyyy}-${mm}-${dd}.log`);
}

/**
 * Read the last `n` lines from a file. Returns empty string if the file
 * does not exist or cannot be read.
 */
function readLastLines(filePath, n) {
  try {
    if (!fs.existsSync(filePath)) return '';
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter(l => l.trim());
    return lines.slice(-n).join('\n');
  } catch {
    return '';
  }
}

/**
 * Extract the Node version from a log startup line.
 * The startup entry looks like: {"ts":"...","msg":"FocusBoard starting","data":{"port":3001,"node":"v20.x.x"}}
 */
function extractNodeVersion(logContent) {
  try {
    const lines = logContent.split('\n');
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const entry = JSON.parse(line);
        if (entry.msg && entry.msg.includes('FocusBoard starting') && entry.data?.node) {
          return entry.data.node;
        }
      } catch { /* skip malformed lines */ }
    }
  } catch { /* ignore */ }
  return 'unknown';
}

async function githubRequest(method, endpoint, token, body) {
  const res = await fetch(`https://api.github.com${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, data: JSON.parse(text) };
  } catch {
    return { ok: res.ok, status: res.status, data: text };
  }
}

const router = Router();

router.post('/', async (req, res) => {
  const { description, userAgent } = req.body || {};

  if (!description || typeof description !== 'string' || !description.trim()) {
    return res.status(400).json({ success: false, error: 'Description is required' });
  }

  const cfg = loadConfig();
  if (!cfg.githubToken) {
    return res.status(503).json({ success: false, error: 'GitHub not configured — set a GitHub token in Settings' });
  }

  // Read last 100 lines from today's log; fall back to yesterday's if empty
  const todayPath = logPathForOffset(0);
  const yesterdayPath = logPathForOffset(-1);

  let logContent = readLastLines(todayPath, 100);
  let logSource = 'today';
  if (!logContent) {
    logContent = readLastLines(yesterdayPath, 100);
    logSource = 'yesterday';
  }

  // Read the full today log for Node version extraction (it may be near the top)
  let fullTodayLog = '';
  try {
    if (fs.existsSync(todayPath)) fullTodayLog = fs.readFileSync(todayPath, 'utf8');
    else if (fs.existsSync(yesterdayPath)) fullTodayLog = fs.readFileSync(yesterdayPath, 'utf8');
  } catch { /* ignore */ }

  const nodeVersion = extractNodeVersion(fullTodayLog);
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const timeStr = now.toTimeString().slice(0, 5);

  const issueTitle = `Bug Report: ${description.slice(0, 80).trim()} - ${dateStr} ${timeStr}`;

  const logBlock = logContent
    ? `\`\`\`\n${logContent}\n\`\`\``
    : '_No log file found_';

  const issueBody = [
    '## User Description',
    '',
    description.trim(),
    '',
    '## System Info',
    '',
    `| Field | Value |`,
    `|---|---|`,
    `| Date | ${dateStr} |`,
    `| Time | ${timeStr} |`,
    `| Node Version | ${nodeVersion} |`,
    `| User Agent | ${(userAgent || 'unknown').slice(0, 200)} |`,
    `| Log Source | ${logSource} |`,
    '',
    '## Last 100 Lines of Server Log',
    '',
    logBlock,
  ].join('\n');

  try {
    // Attempt to create the issue with the `bug` label
    const result = await githubRequest('POST', `/repos/${REPO}/issues`, cfg.githubToken, {
      title: issueTitle,
      body: issueBody,
      labels: ['bug'],
    });

    if (result.ok && result.data?.html_url) {
      logger.info('Bug report issue created', { url: result.data.html_url });
      return res.json({ success: true, issueUrl: result.data.html_url });
    }

    // If the label doesn't exist the API may reject with 422 — retry without label
    if (result.status === 422) {
      logger.warn('Bug label may not exist, retrying without label', {});
      const retry = await githubRequest('POST', `/repos/${REPO}/issues`, cfg.githubToken, {
        title: issueTitle,
        body: issueBody,
      });
      if (retry.ok && retry.data?.html_url) {
        logger.info('Bug report issue created (no label)', { url: retry.data.html_url });
        return res.json({ success: true, issueUrl: retry.data.html_url });
      }
      return res.json({ success: false, error: `GitHub error ${retry.status}: ${JSON.stringify(retry.data)}` });
    }

    return res.json({ success: false, error: `GitHub error ${result.status}: ${JSON.stringify(result.data)}` });
  } catch (err) {
    logger.error('Bug report failed', { error: err.message });
    return res.json({ success: false, error: err.message });
  }
});

export default router;
