/**
 * @file routes/update.js
 * Checks GitHub Releases for a newer version of FocusBoard.
 * Returns the latest release info so the frontend can show an update banner.
 */

import { Router } from 'express';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { decryptConfig } from '../crypto-utils.js';
import { logger } from '../logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = 'Briancoughlin/FocusBoard';

function loadConfig() {
  const CONFIG_PATH = path.join(__dirname, '..', 'config.json');
  if (!fs.existsSync(CONFIG_PATH)) return {};
  try {
    const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    if (raw.encrypted === true) return decryptConfig(raw);
    return raw;
  } catch { return {}; }
}

function getCurrentVersion() {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'package.json'), 'utf8'));
    return `v${pkg.version}`;
  } catch { return 'v0.0.0'; }
}

const router = Router();

// GET /api/update/check — compare current version against latest GitHub release
router.get('/check', async (req, res) => {
  try {
    const cfg = loadConfig();
    const token = cfg.githubToken;
    const headers = {
      'Accept': 'application/vnd.github+json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
    };

    const response = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers });
    if (!response.ok) throw new Error(`GitHub API ${response.status}`);

    const release = await response.json();
    const latestVersion = release.tag_name;
    const currentVersion = getCurrentVersion();

    const hasUpdate = latestVersion !== currentVersion;
    logger.info('Update check', { current: currentVersion, latest: latestVersion, hasUpdate });

    res.json({
      hasUpdate,
      currentVersion,
      latestVersion,
      releaseUrl: release.html_url,
      releaseName: release.name,
      releaseNotes: release.body?.slice(0, 500) || '',
      publishedAt: release.published_at,
    });
  } catch (err) {
    logger.warn('Update check failed', { error: err.message });
    res.json({ hasUpdate: false, error: err.message });
  }
});

// POST /api/update/apply — pull latest code, install deps, rebuild, restart
router.post('/apply', async (req, res) => {
  logger.info('Update apply requested');
  // Respond immediately so the frontend gets a response before the server restarts
  res.json({ success: true, message: 'Update started — FocusBoard will restart in a few seconds' });

  // Run update asynchronously after response is sent
  setTimeout(async () => {
    try {
      const projectRoot = path.join(__dirname, '..', '..');
      logger.info('Running git pull...');
      execSync('git pull origin main', { cwd: projectRoot, stdio: 'pipe' });

      logger.info('Installing backend dependencies...');
      execSync('npm install', { cwd: path.join(projectRoot, 'backend'), stdio: 'pipe' });

      logger.info('Installing frontend dependencies...');
      execSync('npm install', { cwd: path.join(projectRoot, 'frontend'), stdio: 'pipe' });

      logger.info('Building frontend...');
      execSync('npm run build', { cwd: path.join(projectRoot, 'frontend'), stdio: 'pipe' });

      logger.info('Update complete — restarting...');
      process.exit(0); // Scheduled task will restart the process
    } catch (err) {
      logger.error('Update failed', { error: err.message });
    }
  }, 500);
});

export default router;
