import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, '..', 'config.json');

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) return {};
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); } catch { return {}; }
}

function mapJiraStatus(statusCategory) {
  switch (statusCategory) {
    case 'To Do': return 'todo';
    case 'In Progress': return 'inprogress';
    case 'Done': return 'done';
    default: return 'waiting';
  }
}

function mapJiraPriority(priorityName) {
  if (!priorityName) return 'medium';
  const name = priorityName.toLowerCase();
  if (name === 'highest' || name === 'high') return 'high';
  if (name === 'low' || name === 'lowest') return 'low';
  return 'medium';
}

const router = Router();

router.get('/', async (req, res) => {
  const cfg = loadConfig();
  if (!cfg.jiraUrl || !cfg.jiraEmail || !cfg.jiraToken) {
    return res.json({ tasks: [], error: 'Jira not configured' });
  }

  try {
    const jql = encodeURIComponent('assignee=currentUser() AND resolution=Unresolved ORDER BY updated DESC');
    const fields = 'summary,status,priority,duedate,assignee,description';
    // Try REST API v2 for self-hosted Jira Data Center (v3 is Atlassian Cloud only)
    const url = `${cfg.jiraUrl}/rest/api/2/search?jql=${jql}&fields=${fields}&maxResults=50`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${cfg.jiraToken}`,
        'Accept': 'application/json',
      },
    });

    const text = await response.text();
    console.log('Jira response status:', response.status, response.url);
    console.log('Jira response preview:', text.slice(0, 300));

    if (!response.ok || text.trim().startsWith('<')) {
      throw new Error(`Jira API error ${response.status}: ${text.slice(0, 200)}`);
    }

    const data = JSON.parse(text);
    const tasks = (data.issues || []).map((issue) => ({
      id: `jira-${issue.id}`,
      sourceId: issue.id,
      title: issue.fields.summary,
      description: typeof issue.fields.description === 'string' ? issue.fields.description : (issue.fields.description?.content?.[0]?.content?.[0]?.text || ''),
      source: 'jira',
      status: mapJiraStatus(issue.fields.status?.statusCategory?.name),
      priority: mapJiraPriority(issue.fields.priority?.name),
      dueDate: issue.fields.duedate || undefined,
      url: `${cfg.jiraUrl}/browse/${issue.key}`,
      updatedAt: new Date().toISOString(),
    }));

    res.json({ tasks });
  } catch (err) {
    console.error('Jira error:', err.message, err.cause);
    res.json({ tasks: [], error: err.message, cause: String(err.cause || '') });
  }
});

export default router;
