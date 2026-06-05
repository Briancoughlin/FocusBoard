/**
 * @file routes/jira.js
 * Jira REST API integration — fetches issues assigned to the current user.
 *
 * Auth: Bearer token (Jira Data Center / Server). Atlassian Cloud uses Basic auth
 * with an API token, but this app targets self-hosted Data Center where a Personal
 * Access Token is passed as a Bearer header (REST API v2).
 *
 * Key behaviours:
 *  - Paginates through all matching issues (200 per page)
 *  - Resolves epic names via a secondary batch search query
 *  - Maps Jira's free-form status strings to FocusBoard's four status buckets
 */

import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { decryptConfig } from '../crypto-utils.js';
import { logger } from '../logger.js';

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

/**
 * Map a Jira status string to one of FocusBoard's four status buckets.
 *
 * Jira allows completely custom workflow statuses, so we do substring matching
 * on the status name first (handles "In Progress", "In Review", "On Hold", etc.)
 * and fall back to Jira's broader status category when nothing matches.
 *
 * Examples:
 *   "In Progress"         → 'inprogress'
 *   "In Review"           → 'inprogress'  (reviewer is still working on it)
 *   "Waiting for Customer"→ 'waiting'
 *   "Released to Prod"    → 'waiting'     (contains "release")
 *   category "Done"       → 'done'
 *   anything else         → 'waiting'     (safe default — won't be hidden)
 *
 * @param {string} statusName     - Jira status display name (e.g. "In Progress")
 * @param {string} statusCategory - Jira category name (e.g. "In Progress", "To Do", "Done")
 * @returns {'todo'|'inprogress'|'waiting'|'done'}
 */
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
  // Fall back to Jira's built-in category when the status name doesn't match
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

  const syncDone = logger.time('Jira sync');
  let pageNum = 0;
  const epicNames = {};

  try {
    const defaultJql = 'assignee=currentUser() AND resolution=Unresolved ORDER BY updated DESC';
    const jql = encodeURIComponent(cfg.jiraJql || defaultJql);
    const fields = 'summary,status,priority,duedate,assignee,description,customfield_10006,fixVersions';
    // REST API v2 is used instead of v3 because v3 is Atlassian Cloud-only.
    // Self-hosted Jira Data Center exposes v2 with Bearer token (Personal Access Token).
    //
    // Pagination: Jira caps results per request (default 50, max ~1000 depending on
    // server config). We request 200 per page and loop until allIssues.length >= total.
    let allIssues = [];
    let startAt = 0;
    const pageSize = 200;

    logger.info('Jira pagination start', {});

    while (true) {
      const pageUrl = `${cfg.jiraUrl}/rest/api/2/search?jql=${jql}&fields=${fields}&maxResults=${pageSize}&startAt=${startAt}`;
      const pageRes = await fetch(pageUrl, {
        headers: { 'Authorization': `Bearer ${cfg.jiraToken}`, 'Accept': 'application/json' },
      });
      // Read as text first — a misconfigured Jira can return an HTML error page with
      // a 200 status, so we check the content before trying to parse JSON.
      const text = await pageRes.text();
      if (!pageRes.ok || text.trim().startsWith('<')) {
        throw new Error(`Jira API error ${pageRes.status}: ${text.slice(0, 200)}`);
      }
      const data = JSON.parse(text);
      allIssues = allIssues.concat(data.issues || []);
      pageNum++;
      logger.info('Jira page fetched', { page: pageNum, fetched: allIssues.length, total: data.total });
      if (allIssues.length >= data.total) break;
      startAt += pageSize;
    }

    // Epic names are not included in the standard search response — customfield_10006
    // holds the epic *key* (e.g. "PROJ-123") but not its summary. We deduplicate the
    // epic keys across all issues and make a single secondary search to resolve their
    // summaries, then join by key when building task objects below.
    // This is done in a try/catch so a permissions error on epics doesn't break the whole sync.
    const epicKeys = [...new Set(allIssues.map(i => i.fields.customfield_10006).filter(Boolean))];
    if (epicKeys.length > 0) {
      try {
        const epicJql = encodeURIComponent(`key in (${epicKeys.join(',')})`);
        const epicRes = await fetch(`${cfg.jiraUrl}/rest/api/2/search?jql=${epicJql}&fields=summary&maxResults=100`, {
          headers: { 'Authorization': `Bearer ${cfg.jiraToken}`, 'Accept': 'application/json' },
        });
        const epicData = await epicRes.json();
        (epicData.issues || []).forEach(e => { epicNames[e.key] = e.fields.summary; });
        logger.info('Jira epics resolved', { count: Object.keys(epicNames).length });
      } catch (e) {
        logger.error('Failed to fetch epic names', { error: e.message });
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
      fixVersion: issue.fields.fixVersions?.[0]?.name || undefined,
      updatedAt: new Date().toISOString(),
    }));

    syncDone({ tickets: tasks.length, pages: pageNum, epics: Object.keys(epicNames).length });
    res.json({ tasks });
  } catch (err) {
    logger.error('Jira error', { error: err.message, cause: String(err.cause || '') });

    // Detect network-level failures that are almost always a VPN/connectivity issue:
    //   ECONNREFUSED  — server port is closed (VPN not connected, wrong URL)
    //   ENOTFOUND     — hostname doesn't resolve (VPN not connected)
    //   ETIMEDOUT     — connection timed out (VPN connected but Jira unreachable)
    //   ECONNRESET    — connection dropped mid-request
    //   fetch failed  — Node's generic fetch wrapper message for all of the above
    const msg = err.message || '';
    const cause = String(err.cause || '');
    const networkCodes = ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET', 'EHOSTUNREACH'];
    const vpnLikely = networkCodes.some(c => msg.includes(c) || cause.includes(c))
      || (msg.toLowerCase().includes('fetch failed') && !msg.includes('401') && !msg.includes('403'));

    res.json({
      tasks: [],
      error: vpnLikely
        ? `Jira unreachable — are you on VPN or Netbird?`
        : err.message,
      cause: cause,
      vpnLikely,
    });
  }
});

export default router;
