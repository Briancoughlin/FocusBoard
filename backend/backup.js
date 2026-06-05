/**
 * @file backup.js
 * Standalone nightly backup script for FocusBoard.
 *
 * Creates a gzipped JSON bundle of config.json and all files in data/,
 * saved to backend/backups/focusboard-backup-YYYY-MM-DD.gz
 * Keeps only the last 7 backups (deletes older ones).
 *
 * Run with: node backup.js
 * Or: npm run backup
 */

import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';
import { promisify } from 'util';
import { logger } from './logger.js';
import { E } from './error-codes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const gzip = promisify(zlib.gzip);

const BACKUP_DIR = path.join(__dirname, 'backups');
const CONFIG_PATH = path.join(__dirname, 'config.json');
const DATA_DIR = path.join(__dirname, 'data');
const MAX_BACKUPS = 7;

/**
 * Collect all files to back up.
 * Returns a map of relative path -> Buffer for each file.
 * Missing files are silently skipped.
 */
function collectFiles() {
  const files = {};

  // config.json
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      files['config.json'] = fs.readFileSync(CONFIG_PATH);
    } catch (err) {
      logger.warn('Backup: could not read config.json', { error: err.message });
    }
  }

  // data/ directory
  if (fs.existsSync(DATA_DIR)) {
    try {
      const entries = fs.readdirSync(DATA_DIR, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile()) {
          const fullPath = path.join(DATA_DIR, entry.name);
          try {
            files[`data/${entry.name}`] = fs.readFileSync(fullPath);
          } catch (err) {
            logger.warn('Backup: could not read data file', { file: entry.name, error: err.message });
          }
        }
      }
    } catch (err) {
      logger.warn('Backup: could not read data/ directory', { error: err.message });
    }
  }

  return files;
}

/**
 * Build the backup bundle object.
 * Files are base64-encoded so the bundle is pure JSON.
 */
function buildBundle(files) {
  const bundle = {
    version: '1.0',
    createdAt: new Date().toISOString(),
    files: {},
  };
  for (const [relPath, buf] of Object.entries(files)) {
    bundle.files[relPath] = buf.toString('base64');
  }
  return bundle;
}

/**
 * Delete oldest backups, keeping only MAX_BACKUPS total.
 */
function pruneOldBackups(backupDir) {
  const files = fs.readdirSync(backupDir)
    .filter(f => f.startsWith('focusboard-backup-') && f.endsWith('.gz'))
    .map(f => ({ name: f, mtime: fs.statSync(path.join(backupDir, f)).mtimeMs }))
    .sort((a, b) => a.mtime - b.mtime); // oldest first

  const toDelete = files.slice(0, Math.max(0, files.length - MAX_BACKUPS));
  for (const f of toDelete) {
    try {
      fs.unlinkSync(path.join(backupDir, f.name));
      logger.info('Backup: deleted old backup', { file: f.name });
    } catch (err) {
      logger.warn('Backup: could not delete old backup', { file: f.name, error: err.message });
    }
  }
}

async function runBackup() {
  logger.info('Backup: starting nightly backup', {});

  // Ensure backup directory exists
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    logger.info('Backup: created backups directory', {});
  }

  // Collect files
  const files = collectFiles();
  const fileCount = Object.keys(files).length;

  if (fileCount === 0) {
    logger.warn('Backup: no files found to back up', {});
    return;
  }

  logger.info('Backup: collected files', { count: fileCount, files: Object.keys(files) });

  // Build bundle
  const bundle = buildBundle(files);
  const bundleJson = JSON.stringify(bundle);

  // Gzip it
  const compressed = await gzip(bundleJson);

  // Write to file
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const backupFile = path.join(BACKUP_DIR, `focusboard-backup-${date}.gz`);

  fs.writeFileSync(backupFile, compressed);
  const sizekb = Math.round(compressed.length / 1024);
  logger.info('Backup: backup written', { file: backupFile, sizeKB: sizekb });

  // Prune old backups
  pruneOldBackups(BACKUP_DIR);

  logger.info('Backup: nightly backup complete', { date, files: fileCount, sizeKB: sizekb });
}

runBackup().catch(err => {
  logger.error('Backup: backup failed', { code: E.BACKUP_FAILED, error: err.message, stack: err.stack });
  process.exit(1);
});
