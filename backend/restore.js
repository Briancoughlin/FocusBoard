/**
 * @file restore.js
 * Restores a FocusBoard backup created by backup.js.
 *
 * Usage:
 *   node restore.js                          # restore the most recent backup
 *   node restore.js path/to/backup.gz        # restore a specific backup file
 *   npm run restore                          # restore most recent
 *
 * The script lists available backups, decodes each base64-encoded file,
 * and writes them back to their original locations.
 * Existing files are overwritten.
 */

import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';
import { promisify } from 'util';
import { logger } from './logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const gunzip = promisify(zlib.gunzip);

const BACKUP_DIR = path.join(__dirname, 'backups');

function findMostRecent() {
  if (!fs.existsSync(BACKUP_DIR)) {
    throw new Error(`Backup directory not found: ${BACKUP_DIR}`);
  }
  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('focusboard-backup-') && f.endsWith('.gz'))
    .map(f => ({ name: f, mtime: fs.statSync(path.join(BACKUP_DIR, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime); // newest first

  if (files.length === 0) {
    throw new Error('No backup files found in ' + BACKUP_DIR);
  }

  return path.join(BACKUP_DIR, files[0].name);
}

async function runRestore(backupPath) {
  logger.info('Restore: starting restore', { file: backupPath });

  if (!fs.existsSync(backupPath)) {
    throw new Error(`Backup file not found: ${backupPath}`);
  }

  // Read and decompress
  const compressed = fs.readFileSync(backupPath);
  const jsonBuf = await gunzip(compressed);
  const bundle = JSON.parse(jsonBuf.toString('utf8'));

  if (bundle.version !== '1.0') {
    logger.warn('Restore: unknown backup version', { version: bundle.version });
  }

  logger.info('Restore: backup metadata', { createdAt: bundle.createdAt, files: Object.keys(bundle.files) });

  // Restore each file
  let restored = 0;
  for (const [relPath, b64] of Object.entries(bundle.files)) {
    const destPath = path.join(__dirname, relPath);
    const destDir = path.dirname(destPath);

    // Ensure parent directory exists
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    const content = Buffer.from(b64, 'base64');
    fs.writeFileSync(destPath, content);
    logger.info('Restore: wrote file', { path: relPath, bytes: content.length });
    restored++;
  }

  logger.info('Restore: restore complete', { file: backupPath, filesRestored: restored });
  console.log(`Restore complete: ${restored} files restored from ${backupPath}`);
}

// Determine backup file to restore
const targetFile = process.argv[2]
  ? path.resolve(process.argv[2])
  : findMostRecent();

runRestore(targetFile).catch(err => {
  logger.error('Restore: restore failed', { error: err.message, stack: err.stack });
  console.error('Restore failed:', err.message);
  process.exit(1);
});
