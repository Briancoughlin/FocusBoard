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
import { logger } from '../logger.js';
import { E } from '../error-codes.js';

const DATA_DIR = path.join(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, '$1'), '..', 'data');

function loadFeedback() {
  try {
    const p = path.join(DATA_DIR, 'gmail-feedback.json');
    return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : {};
  } catch { return {}; }
}

function loadNoisePatterns() {
  try {
    const p = path.join(DATA_DIR, 'gmail-noise-patterns.json');
    return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : [];
  } catch { return []; }
}

function saveNoisePatterns(patterns) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(path.join(DATA_DIR, 'gmail-noise-patterns.json'), JSON.stringify(patterns, null, 2));
  } catch { /* non-fatal */ }
}

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
    logger.info('Gmail token refreshed', { hasRefreshToken: !!tokens.refresh_token });
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

  const syncDone = logger.time('Gmail sync');
  logger.info('Gmail fetch start', {});

  try {
    const auth = getOAuth2Client(cfg);
    const gmail = google.gmail({ version: 'v1', auth });

    // Build the Gmail search query — use apiCutoffDate when set, else default to 1 day
    let gmailQuery = 'newer_than:1d';
    if (cfg.apiCutoffDate) {
      const cutoff = new Date(cfg.apiCutoffDate);
      const msPerDay = 86400000;
      const daysSince = Math.max(1, Math.ceil((Date.now() - cutoff.getTime()) / msPerDay));
      gmailQuery = `newer_than:${daysSince}d`;
      logger.info('Gmail using cutoff date filter', { apiCutoffDate: cfg.apiCutoffDate, daysSince });
    }

    // Fetch inbox messages starting from the configured cutoff date
    const listRes = await gmail.users.messages.list({
      userId: 'me',
      labelIds: ['INBOX'],
      maxResults: 50,
      q: gmailQuery,
    });

    const messageIds = (listRes.data.messages || []).map(m => m.id);
    logger.info('Gmail messages found', { count: messageIds.length });
    if (messageIds.length === 0) {
      syncDone({ messages: 0, slackDigests: 0, actionItems: 0 });
      return res.json({ tasks: [] });
    }

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

    const slackDigestCount = messages.filter(m => m.isSlackDigest).length;
    logger.info('Gmail Slack digests detected', { count: slackDigestCount });

    // Load learned noise patterns to inform Claude
    const noisePatterns = loadNoisePatterns();

    // Use Claude to extract action items
    const actionItems = await extractActionItems(messages, 'gmail', noisePatterns);
    logger.info('Gmail Claude extraction result', { actionItems: actionItems.length });

    // Build a Set of Gmail message IDs that are Slack digests so we can re-classify
    // action items returned by Claude. Claude receives the message ID as sourceId, so
    // we check membership here rather than re-parsing Claude's output.
    const slackMessageIds = new Set(
      messages.filter(m => m.isSlackDigest).map(m => m.id)
    );

    // Build a map of messageId → raw snippet for hover preview
    const snippetMap = Object.fromEntries(messages.map(m => [m.id, m.snippet || '']));

    const tasks = actionItems.map((item) => {
      const isSlack = slackMessageIds.has(item.sourceId) || item.isSlackDigest;
      const confidence = typeof item.confidence === 'number'
        ? Math.max(0, Math.min(1, item.confidence))
        : 0.8; // default for backward compat
      return {
        id: `${isSlack ? 'slack' : 'gmail'}-${item.sourceId}`,
        sourceId: item.sourceId,
        title: item.title,
        description: item.description,
        source: isSlack ? 'slack' : 'gmail',
        status: 'todo',
        priority: isSlack ? 'high' : (item.priority || 'medium'),
        dueDate: item.dueDate || undefined,
        url: `https://mail.google.com/mail/u/0/#inbox/${item.sourceId}`,
        updatedAt: isSlack ? new Date(Date.now() + 86400000).toISOString() : new Date().toISOString(),
        confidence,
        emailSnippet: isSlack ? undefined : (snippetMap[item.sourceId] || '').slice(0, 300),
      };
    });

    syncDone({ messages: messageIds.length, slackDigests: slackDigestCount, actionItems: tasks.length });
    res.json({ tasks });
  } catch (err) {
    logger.error('Gmail error', { code: E.GMAIL_EXTRACT_FAILED, error: err.message });
    res.json({ tasks: [], error: err.message });
  }
});

/**
 * POST /api/gmail/feedback
 * Records "not an action" feedback for a Gmail item.
 * Body: { taskId, sourceId, from, subject, confidence }
 * Rebuilds noise patterns from accumulated feedback.
 */
router.post('/feedback', (req, res) => {
  try {
    const { taskId, sourceId, from = '', subject = '', confidence = 0.8 } = req.body;
    if (!taskId || typeof taskId !== 'string' || taskId.length > 200) {
      return res.status(400).json({ error: 'taskId required and must be a string under 200 chars' });
    }
    // Clamp inputs to safe lengths before persisting in noise patterns
    const safeFrom    = String(from).slice(0, 500);
    const safeSubject = String(subject).slice(0, 500);
    const safeConf    = typeof confidence === 'number' ? Math.max(0, Math.min(1, confidence)) : 0.8;

    // Persist the feedback entry
    const feedbackPath = path.join(DATA_DIR, 'gmail-feedback.json');
    const feedback = loadFeedback();
    feedback[taskId] = { sourceId, from: safeFrom, subject: safeSubject, confidence: safeConf, timestamp: new Date().toISOString(), verdict: 'not_action' };
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(feedbackPath, JSON.stringify(feedback, null, 2));

    // Rebuild noise patterns: group by sender and subject keywords
    const entries = Object.values(feedback).filter(e => e.verdict === 'not_action');
    const senderCounts = {};
    const subjectCounts = {};
    for (const e of entries) {
      const sender = (e.from || '').toLowerCase().replace(/.*<|>/g, '').trim();
      if (sender) senderCounts[sender] = (senderCounts[sender] || 0) + 1;
      // Extract meaningful subject words (3+ chars, ignore common noise)
      const stopWords = new Set(['re:', 'fw:', 'fwd:', 'the', 'and', 'for', 'you', 'your', 'with', 'this', 'that']);
      const words = (e.subject || '').toLowerCase().split(/\s+/).filter(w => w.length >= 3 && !stopWords.has(w));
      for (const word of words.slice(0, 3)) {
        subjectCounts[word] = (subjectCounts[word] || 0) + 1;
      }
    }

    const totalFeedback = entries.length || 1;
    const patterns = [
      ...Object.entries(senderCounts)
        .filter(([, c]) => c >= 2) // at least 2 "not action" hits before we learn
        .map(([pattern, count]) => ({ type: 'sender', pattern, count, falsePositiveRate: Math.min(0.95, count / totalFeedback) })),
      ...Object.entries(subjectCounts)
        .filter(([, c]) => c >= 3)
        .map(([pattern, count]) => ({ type: 'subject', pattern, count, falsePositiveRate: Math.min(0.95, count / totalFeedback) })),
    ].sort((a, b) => b.falsePositiveRate - a.falsePositiveRate).slice(0, 20); // top 20 patterns

    saveNoisePatterns(patterns);
    logger.info('Gmail feedback recorded', { taskId, patterns: patterns.length });
    res.json({ success: true, patternsLearned: patterns.length });
  } catch (err) {
    logger.error('Gmail feedback error', { code: E.GMAIL_FEEDBACK_FAILED, error: err.message });
    res.status(500).json({ error: err.message });
  }
});

export default router;
