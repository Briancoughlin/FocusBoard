import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { decryptConfig } from '../crypto-utils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, '..', 'config.json');

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) return {};
  try {
    const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    if (raw.encrypted === true) return decryptConfig(raw);
    return raw;
  } catch { return {}; }
}

const router = Router();

// POST /api/jira/create — create a new Jira issue
router.post('/create', async (req, res) => {
  const cfg = loadConfig();
  if (!cfg.jiraUrl || !cfg.jiraToken) {
    return res.status(400).json({ error: 'Jira not configured' });
  }

  const { summary, description, projectKey, issueType, priority, fixVersion } = req.body;
  if (!summary || !projectKey) {
    return res.status(400).json({ error: 'summary and projectKey are required' });
  }

  try {
    const url = `${cfg.jiraUrl}/rest/api/2/issue`;
    const body = {
      fields: {
        project: { key: projectKey },
        summary,
        description: description || '',
        issuetype: { name: issueType || 'Task' },
        ...(priority && { priority: { name: priority } }),
        ...(fixVersion && { fixVersions: [{ name: fixVersion }] }),
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cfg.jiraToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Jira API error ${response.status}: ${text.slice(0, 300)}`);
    }

    const data = JSON.parse(text);
    return res.json({
      key: data.key,
      id: data.id,
      url: `${cfg.jiraUrl}/browse/${data.key}`,
    });
  } catch (err) {
    console.error('Jira create error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/jira/projects — fetch available Jira projects
router.get('/projects', async (req, res) => {
  const cfg = loadConfig();
  if (!cfg.jiraUrl || !cfg.jiraToken) {
    return res.status(400).json({ error: 'Jira not configured' });
  }

  try {
    const url = `${cfg.jiraUrl}/rest/api/2/project`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${cfg.jiraToken}`,
        'Accept': 'application/json',
      },
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Jira API error ${response.status}: ${text.slice(0, 300)}`);
    }

    const data = JSON.parse(text);
    const projects = (Array.isArray(data) ? data : []).map(p => ({
      key: p.key,
      name: p.name,
    }));

    return res.json({ projects, defaultProject: cfg.defaultJiraProject || '' });
  } catch (err) {
    console.error('Jira projects error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
