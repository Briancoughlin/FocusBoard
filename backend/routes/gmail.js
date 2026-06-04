/**
 * @file routes/gmail.js
 * Gmail integration — fetches today's inbox messages and uses Claude to extract
 * actionable to-do items from them.
 *
 * Slack digest emails receive special treatment: they are detected by sender/subject
 * heuristics, fetched with their full plain-text body (not just the snippet), and
 * tagged as `source: 'slack'` so the frontend can display them in the Slack section.
 *
 * Requires Google OAuth credentials and an Anthropic API key.
 */

import { Router } from 'express';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractActionItems } from './claude.js';
import { decryptConfig, encryptConfig } from '../crypto-utils.js';

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

function saveConfig(data) {
  const encrypted = encryptConfig(data);
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(encrypted, null, 2), 'utf8');
}

function getOAuth2Client(cfg) {
  const oauth2 = new google.auth.OAuth2(
    cfg.googleClientId,
    cfg.googleClientSecret,
    'http://localhost:3001/auth/google/callback'
  );
  oauth2.setCredentials({
    access_token: cfg.googleAccessToken,
    refresh_token: cfg.googleRefreshToken,
  });
  // Auto-save refreshed tokens back to config so the new access token persists
  oauth2.on('tokens', (tokens) => {
    const current = loadConfig();
    saveConfig({
      ...current,
      googleAccessToken: tokens.access_token || current.googleAccessToken,
      ...(tokens.refresh_token && { googleRefreshToken: tokens.refresh_token }),
    });
  });
  return oauth2;
}

function decodeBase64(str) {
  return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

function getHeader(headers, name) {
  return headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';
}

const router = Router();

router.get('/', async (req, res) => {
  const cfg = loadConfig();
  if (!cfg.googleClientId || !cfg.googleClientSecret || !cfg.googleAccessToken) {
    return res.json({ tasks: [], error: 'Gmail not configured' });
  }
  if (!cfg.anthropicKey) {
    return res.json({ tasks: [], error: 'Anthropic API key required for Gmail action extraction' });
  }

  try {
    const auth = getOAuth2Client(cfg);
    const gmail = google.gmail({ version: 'v1', auth });

    // Fetch today's inbox messages only
    const listRes = await gmail.users.messages.list({
      userId: 'me',
      labelIds: ['INBOX'],
      maxResults: 50,
      q: 'newer_than:1d',
    });

    const messageIds = (listRes.data.messages || []).map(m => m.id);
    if (messageIds.length === 0) return res.json({ tasks: [] });

    // Fetch message details in parallel
    const messageDetails = await Promise.allSettled(
      messageIds.map(id =>
        gmail.users.messages.get({ userId: 'me', id, format: 'full', metadataHeaders: ['Subject', 'From', 'Date'] })
      )
    );

    const messages = messageDetails
      .filter(r => r.status === 'fulfilled')
      .map(r => {
        const msg = r.value.data;
        const headers = msg.payload?.headers || [];
        const subject = getHeader(headers, 'Subject') || '(no subject)';
        const from = getHeader(headers, 'From') || 'Unknown';

        // Detect Slack digest emails by sender name or common subject patterns.
        // Slack sends several notification email types: "missed messages", daily digests,
        // and direct @mentions. All carry actionable content worth surfacing.
        const isSlackDigest = from.toLowerCase().includes('slack') ||
          subject.toLowerCase().includes('digest') ||
          subject.toLowerCase().includes('missed messages') ||
          subject.toLowerCase().includes('mention');

        let snippet = msg.snippet || '';
        if (isSlackDigest && msg.payload) {
          // The Gmail snippet is truncated at ~100 chars — not enough for Claude to
          // reliably extract action items from multi-message digests. Fetching the
          // full message (format: 'full') lets us decode the plain-text part and
          // send up to 2000 chars of actual content to Claude.
          const parts = msg.payload.parts || [msg.payload];
          const textPart = parts.find(p => p.mimeType === 'text/plain');
          if (textPart?.body?.data) {
            snippet = decodeBase64(textPart.body.data).slice(0, 2000);
          }
        }

        return {
          id: msg.id,
          subject,
          from,
          date: getHeader(headers, 'Date') || '',
          snippet,
          isSlackDigest,
        };
      });

    // Use Claude to extract action items
    const actionItems = await extractActionItems(messages, 'gmail');

    // Build a Set of Gmail message IDs that are Slack digests so we can re-classify
    // action items returned by Claude. Claude receives the message ID as sourceId, so
    // we check membership here rather than re-parsing Claude's output.
    const slackMessageIds = new Set(
      messages.filter(m => m.isSlackDigest).map(m => m.id)
    );

    const tasks = actionItems.map((item) => {
      const isSlack = slackMessageIds.has(item.sourceId) || item.isSlackDigest;
      return {
        id: `${isSlack ? 'slack' : 'gmail'}-${item.sourceId}`,
        sourceId: item.sourceId,
        title: item.title,
        description: item.description,
        source: isSlack ? 'slack' : 'gmail',
        status: 'todo',
        // Slack mentions are treated as high priority — they represent direct asks.
        priority: isSlack ? 'high' : (item.priority || 'medium'),
        dueDate: item.dueDate || undefined,
        url: `https://mail.google.com/mail/u/0/#inbox/${item.sourceId}`,
        // Give Slack-sourced tasks a future updatedAt so sort-by-updated places them
        // above regular Gmail items without needing a separate sort key.
        updatedAt: isSlack ? new Date(Date.now() + 86400000).toISOString() : new Date().toISOString(),
      };
    });

    res.json({ tasks });
  } catch (err) {
    console.error('Gmail error:', err.message);
    res.json({ tasks: [], error: err.message });
  }
});

export default router;
