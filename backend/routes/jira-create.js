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
    const issueKey = data.key;

    // Immediately transition to In Progress
    try {
      const transitionsUrl = `${cfg.jiraUrl}/rest/api/2/issue/${issueKey}/transitions`;
      const transitionsRes = await fetch(transitionsUrl, {
        headers: { 'Authorization': `Bearer ${cfg.jiraToken}`, 'Accept': 'application/json' },
      });
      const transitionsData = await transitionsRes.json();
      const inProgressTransition = (transitionsData.transitions || []).find(t => {
        const name = (t.to?.name || '').toLowerCase();
        return name.includes('in progress') || name.includes('in review');
      });
      if (inProgressTransition) {
        await fetch(transitionsUrl, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${cfg.jiraToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ transition: { id: inProgressTransition.id } }),
        });
      }
    } catch (transitionErr) {
      console.warn('Could not auto-transition new ticket to In Progress:', transitionErr.message);
    }

    return res.json({
      key: issueKey,
      id: data.id,
      url: `${cfg.jiraUrl}/browse/${issueKey}`,
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

// POST /api/jira/transition — transition a Jira issue to a new status
router.post('/transition', async (req, res) => {
  const cfg = loadConfig();
  if (!cfg.jiraUrl || !cfg.jiraToken) {
    return res.status(400).json({ error: 'Jira not configured' });
  }

  const { issueKey, targetStatus } = req.body;
  if (!issueKey || !targetStatus) {
    return res.status(400).json({ error: 'issueKey and targetStatus are required' });
  }

  // Map targetStatus to candidate status name substrings (case-insensitive)
  const statusMap = {
    todo: ['ready', 'to do', 'backlog'],
    inprogress: ['in progress', 'in review'],
    waiting: ['hold', 'blocked', 'waiting'],
    done: ['done', 'closed', 'resolved'],
  };

  const candidates = statusMap[targetStatus];
  if (!candidates) {
    return res.status(400).json({ error: `Unknown targetStatus: ${targetStatus}` });
  }

  try {
    // Fetch available transitions
    const transitionsUrl = `${cfg.jiraUrl}/rest/api/2/issue/${issueKey}/transitions`;
    const transitionsResponse = await fetch(transitionsUrl, {
      headers: {
        'Authorization': `Bearer ${cfg.jiraToken}`,
        'Accept': 'application/json',
      },
    });

    const transitionsText = await transitionsResponse.text();
    if (!transitionsResponse.ok) {
      throw new Error(`Jira API error ${transitionsResponse.status}: ${transitionsText.slice(0, 300)}`);
    }

    const transitionsData = JSON.parse(transitionsText);
    const transitions = transitionsData.transitions || [];

    // Find matching transition
    const match = transitions.find(t => {
      const toName = (t.to?.name || '').toLowerCase();
      return candidates.some(c => toName.includes(c));
    });

    if (!match) {
      return res.json({
        success: false,
        error: `No transition found for targetStatus '${targetStatus}'`,
        availableTransitions: transitions.map(t => ({ id: t.id, name: t.name, toStatus: t.to?.name })),
      });
    }

    // Apply the transition
    const applyResponse = await fetch(transitionsUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cfg.jiraToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ transition: { id: match.id } }),
    });

    if (!applyResponse.ok) {
      const applyText = await applyResponse.text();
      throw new Error(`Jira transition error ${applyResponse.status}: ${applyText.slice(0, 300)}`);
    }

    return res.json({ success: true, transitionName: match.name });
  } catch (err) {
    console.error('Jira transition error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
