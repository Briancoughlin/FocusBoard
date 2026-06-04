/**
 * @file routes/github.js
 * GitHub integration — aggregates actionable items from four sources:
 *
 *  1. PRs where your review is explicitly requested (review-requested search)
 *  2. Your own open PRs (author search) — to track merge status
 *  3. Issues assigned to you (assignee search)
 *  4. Unread notifications filtered to CI failures, review requests, and mentions
 *
 * Supports GitHub Enterprise (self-hosted) via the `githubBaseUrl` config field.
 * All requests use Bearer token auth with the GitHub API v2022-11-28 header.
 */

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

async function githubFetch(url, token, baseUrl) {
  const base = baseUrl ? baseUrl.replace(/\/$/, '') : 'https://api.github.com';
  const fullUrl = url.startsWith('http') ? url : `${base}${url}`;
  const res = await fetch(fullUrl, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!res.ok) throw new Error(`GitHub API error ${res.status}: ${await res.text()}`);
  return res.json();
}

function mapPRPriority(pr) {
  if (pr.draft) return 'low';
  const daysSinceUpdate = (Date.now() - new Date(pr.updated_at).getTime()) / 86400000;
  if (daysSinceUpdate < 1) return 'high';
  if (daysSinceUpdate < 3) return 'medium';
  return 'low';
}

const router = Router();

router.get('/', async (req, res) => {
  const cfg = loadConfig();
  if (!cfg.githubToken) {
    return res.json({ tasks: [], error: 'GitHub not configured' });
  }

  const token = cfg.githubToken;
  const baseUrl = cfg.githubBaseUrl || 'https://api.github.com';

  try {
    const tasks = [];

    // Get current user
    const user = await githubFetch('/user', token, baseUrl);
    const username = user.login;

    // 1. PRs awaiting your review
    const reviewRequested = await githubFetch(
      `/search/issues?q=is:open+is:pr+review-requested:${username}&per_page=20`,
      token, baseUrl
    );
    for (const pr of reviewRequested.items || []) {
      tasks.push({
        id: `github-review-${pr.id}`,
        sourceId: String(pr.id),
        title: `Review PR: ${pr.title}`,
        description: `${pr.repository_url?.split('/').slice(-2).join('/')} — review requested`,
        source: 'github',
        status: 'todo',
        priority: 'high',
        dueDate: undefined,
        url: pr.html_url,
        ticketKey: `#${pr.number}`,
        updatedAt: pr.updated_at,
      });
    }

    // 2. Your open PRs
    const myPRs = await githubFetch(
      `/search/issues?q=is:open+is:pr+author:${username}&per_page=20`,
      token, baseUrl
    );
    for (const pr of myPRs.items || []) {
      tasks.push({
        id: `github-pr-${pr.id}`,
        sourceId: String(pr.id),
        title: `PR: ${pr.title}`,
        description: `${pr.repository_url?.split('/').slice(-2).join('/')} — your open PR`,
        source: 'github',
        status: 'inprogress',
        priority: mapPRPriority(pr),
        dueDate: undefined,
        url: pr.html_url,
        ticketKey: `#${pr.number}`,
        updatedAt: pr.updated_at,
      });
    }

    // 3. Issues assigned to you
    const assignedIssues = await githubFetch(
      `/search/issues?q=is:open+is:issue+assignee:${username}&per_page=20`,
      token, baseUrl
    );
    for (const issue of assignedIssues.items || []) {
      tasks.push({
        id: `github-issue-${issue.id}`,
        sourceId: String(issue.id),
        title: `Issue: ${issue.title}`,
        description: `${issue.repository_url?.split('/').slice(-2).join('/')} — assigned to you`,
        source: 'github',
        status: 'todo',
        priority: 'medium',
        dueDate: undefined,
        url: issue.html_url,
        ticketKey: `#${issue.number}`,
        updatedAt: issue.updated_at,
      });
    }

    // 4. Unread notifications — filtered to only the reason types that require action.
    // The notifications API returns all unread events; we only surface:
    //   - ci_activity: build results that need attention (failures) or awareness (passes)
    //   - review_requested: in case the search query above missed it (e.g. team reviews)
    //   - mention / team_mention: direct references that need a response
    // Other reasons (subscribed, assign, state_change) are intentionally skipped to
    // avoid flooding the board with low-signal noise.
    const notifications = await githubFetch(
      '/notifications?all=false&per_page=30',
      token, baseUrl
    );

    for (const notif of notifications || []) {
      const repo = notif.repository.full_name;
      const subjectTitle = notif.subject.title || '';

      // The notifications API returns API URLs (api.github.com/repos/owner/repo/pulls/1).
      // Transform them to browser URLs so clicking opens the right page.
      const url = notif.subject.url
        ?.replace('api.github.com/repos', 'github.com')
        ?.replace('/pulls/', '/pull/')
        ?.replace('/commits/', '/commit/') || notif.repository.html_url;

      if (notif.reason === 'ci_activity') {
        const lower = subjectTitle.toLowerCase();
        const isFail = lower.includes('fail') || lower.includes('error') || lower.includes('cancel');
        const isPass = lower.includes('pass') || lower.includes('success') || lower.includes('succeed');

        // Fetch the latest workflow run to get commit message and duration
        let description = `${subjectTitle} — ${repo}`;
        let runUrl = url;
        try {
          const [owner, repoName] = repo.split('/');
          const runs = await githubFetch(`/repos/${owner}/${repoName}/actions/runs?per_page=1&status=${isFail ? 'failure' : 'success'}`, token, baseUrl);
          const run = runs.workflow_runs?.[0];
          if (run) {
            const commitMsg = run.head_commit?.message?.split('\n')[0] || '';
            const branch = run.head_branch || 'main';
            const duration = run.updated_at && run.created_at
              ? Math.round((new Date(run.updated_at) - new Date(run.created_at)) / 1000)
              : null;
            const durationStr = duration ? ` · ${duration < 60 ? `${duration}s` : `${Math.round(duration/60)}m`}` : '';
            description = `${branch}: ${commitMsg}${durationStr}`;
            runUrl = run.html_url || url;
          }
        } catch { /* fallback to basic description */ }

        tasks.push({
          id: `github-ci-${notif.id}`,
          sourceId: notif.id,
          title: isFail ? `❌ CI Failed: ${repo}` : isPass ? `✅ CI Passed: ${repo}` : `🔄 CI: ${subjectTitle}`,
          description,
          source: 'github',
          status: 'todo',
          priority: isFail ? 'high' : 'low',
          dueDate: undefined,
          url: runUrl,
          updatedAt: notif.updated_at,
        });
      } else if (notif.reason === 'review_requested') {
        tasks.push({
          id: `github-review-notif-${notif.id}`,
          sourceId: notif.id,
          title: `👀 Review requested: ${subjectTitle}`,
          description: `${repo} — your review was requested`,
          source: 'github',
          status: 'todo',
          priority: 'high',
          dueDate: undefined,
          url,
          updatedAt: notif.updated_at,
        });
      } else if (notif.reason === 'mention' || notif.reason === 'team_mention') {
        tasks.push({
          id: `github-mention-${notif.id}`,
          sourceId: notif.id,
          title: `💬 Mentioned: ${subjectTitle}`,
          description: `${repo} — you were mentioned`,
          source: 'github',
          status: 'todo',
          priority: 'medium',
          dueDate: undefined,
          url,
          updatedAt: notif.updated_at,
        });
      }
    }

    res.json({ tasks });
  } catch (err) {
    console.error('GitHub error:', err.message);
    res.json({ tasks: [], error: err.message });
  }
});

export default router;
