/**
 * @file logger.js
 * Structured JSON logger for FocusBoard backend.
 *
 * Writes NDJSON lines to both the console and a daily rotating log file
 * in backend/logs/. No external dependencies — uses Node's built-in fs.
 *
 * Log file format: server-YYYY-MM-DD.log
 * Entry format:    {"ts":"...","level":"info","msg":"...","data":{}}
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGS_DIR = path.join(__dirname, 'logs');
const MAX_DAYS = 7;

// Ensure logs directory exists at import time
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

/**
 * Return the log file path for today's date (server-YYYY-MM-DD.log).
 */
function todayLogPath() {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return path.join(LOGS_DIR, `server-${yyyy}-${mm}-${dd}.log`);
}

/**
 * Delete log files older than MAX_DAYS days.
 * Called once at startup.
 */
function pruneOldLogs() {
  try {
    const cutoff = Date.now() - MAX_DAYS * 24 * 60 * 60 * 1000;
    const files = fs.readdirSync(LOGS_DIR);
    for (const file of files) {
      if (!file.match(/^server-\d{4}-\d{2}-\d{2}\.log$/)) continue;
      const fullPath = path.join(LOGS_DIR, file);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.mtimeMs < cutoff) {
          fs.unlinkSync(fullPath);
        }
      } catch {
        // Ignore individual file errors
      }
    }
  } catch {
    // Don't crash if pruning fails
  }
}

pruneOldLogs();

/**
 * Write one NDJSON line to the current day's log file.
 * Errors are swallowed so logging never breaks the main app.
 */
function writeToFile(line) {
  try {
    fs.appendFileSync(todayLogPath(), line + '\n', 'utf8');
  } catch {
    // Swallow — log file write failures must not crash the server
  }
}

/**
 * Core log function. All exported helpers delegate here.
 *
 * @param {'debug'|'info'|'warn'|'error'} level
 * @param {string} msg
 * @param {object} [data]
 */
export function log(level, msg, data = {}) {
  const entry = { ts: new Date().toISOString(), level, msg, data };
  const line = JSON.stringify(entry);

  // Console output
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }

  writeToFile(line);
}

/**
 * Convenience helper: start a timer, return a function that when called
 * logs the message with an added duration_ms field.
 *
 * Usage:
 *   const done = logger.time('Jira sync');
 *   // ... do work ...
 *   done({ tickets: 42 }); // logs with duration_ms
 *
 * @param {string} msg - Log message to emit on completion
 * @param {'debug'|'info'|'warn'|'error'} [level] - defaults to 'info'
 * @returns {(data?: object) => void}
 */
function time(msg, level = 'info') {
  const start = Date.now();
  return (data = {}) => {
    log(level, msg, { ...data, duration_ms: Date.now() - start });
  };
}

export const logger = {
  debug: (msg, data) => log('debug', msg, data),
  info:  (msg, data) => log('info',  msg, data),
  warn:  (msg, data) => log('warn',  msg, data),
  error: (msg, data) => log('error', msg, data),
  time,
};
