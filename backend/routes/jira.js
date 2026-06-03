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

function mapJiraStatus(statusName, statusCategory) {
  const name = (statusName || '').toLowerCase();
  if (name.includes('ready to start'))          return 'todo';
  if (name.includes('in progress'))             return 'inprogress';
  if (name.includes('in review'))               return 'inprogress';
  if (name.includes('blocked'))                 return 'waiting';
  if (name.includes('on hold'))                 return 'waiting';
  if (name.includes('waiting for customer'))    return 'waiting';
  if (name.includes('release'))                 return 'waiting';
  if (name.includes('done'))                    return 'done';
  // fallback to category
  switch (statusCategory) {
    case 'To Do':       return 'todo';
    case 'In Progress': return 'inprogress';
    case 'Done':        return 'done';
    default:            return 'waiting';
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
    const defaultJql = 'assignee=currentUser() AND resolution=Unresolved ORDER BY updated DESC';
    const jql = encodeURIComponent(cfg.jiraJql || defaultJql);
    const fields = 'summary,status,priority,duedate,assignee,description,customfield_10006';
    // Try REST API v2 for self-hosted Jira Data Center (v3 is Atlassian Cloud only)
    // Paginate through all results
    let allIssues = [];
    let startAt = 0;
    const pageSize = 200;

    while (true) {
      const pageUrl = `${cfg.jiraUrl}/rest/api/2/search?jql=${jql}&fields=${fields}&maxResults=${pageSize}&startAt=${startAt}`;
      const pageRes = await fetch(pageUrl, {
        headers: { 'Authorization': `Bearer ${cfg.jiraToken}`, 'Accept': 'application/json' },
      });
      const text = await pageRes.text();
      if (!pageRes.ok || text.trim().startsWith('<')) {
        throw new Error(`Jira API error ${pageRes.status}: ${text.slice(0, 200)}`);
      }
      const data = JSON.parse(text);
      allIssues = allIssues.concat(data.issues || []);
      console.log(`Jira: fetched ${allIssues.length} of ${data.total} tickets`);
      if (startAt === 0 && data.issues?.length > 0) {
        const sample = data.issues[0].fields;
        const epicFields = Object.entries(sample)
          .filter(([k, v]) => v !== null && (k.includes('epic') || k.includes('Epic') || (k.startsWith('customfield') && v && typeof v === 'object' && v.key)));
        // Log all non-null custom fields from first ticket to find epic
      }
      if (allIssues.length >= data.total) break;
      startAt += pageSize;
    }

    // Fetch epic summaries for all unique epic keys
    const epicKeys = [...new Set(allIssues.map(i => i.fields.customfield_10006).filter(Boolean))];
    const epicNames = {};
    if (epicKeys.length > 0) {
      try {
        const epicJql = encodeURIComponent(`key in (${epicKeys.join(',')})`);
        const epicRes = await fetch(`${cfg.jiraUrl}/rest/api/2/search?jql=${epicJql}&fields=summary&maxResults=100`, {
          headers: { 'Authorization': `Bearer ${cfg.jiraToken}`, 'Accept': 'application/json' },
        });
        const epicData = await epicRes.json();
        (epicData.issues || []).forEach(e => { epicNames[e.key] = e.fields.summary; });
      } catch (e) {
        console.error('Failed to fetch epic names:', e.message);
      }
    }

    const tasks = (allIssues || []).map((issue) => ({
      id: `jira-${issue.id}`,
      sourceId: issue.id,
      title: issue.fields.summary,
      description: typeof issue.fields.description === 'string' ? issue.fields.description : (issue.fields.description?.content?.[0]?.content?.[0]?.text || ''),
      source: 'jira',
      status: mapJiraStatus(issue.fields.status?.name, issue.fields.status?.statusCategory?.name),
      priority: mapJiraPriority(issue.fields.priority?.name),
      dueDate: issue.fields.duedate || undefined,
      url: `${cfg.jiraUrl}/browse/${issue.key}`,
      ticketKey: issue.key,
      epicKey: issue.fields.customfield_10006 || undefined,
      epicName: issue.fields.customfield_10006 ? (epicNames[issue.fields.customfield_10006] || issue.fields.customfield_10006) : undefined,
      updatedAt: new Date().toISOString(),
    }));

    res.json({ tasks });
  } catch (err) {
    console.error('Jira error:', err.message, err.cause);
    res.json({ tasks: [], error: err.message, cause: String(err.cause || '') });
  }
});

export default router;
