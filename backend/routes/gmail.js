import { Router } from 'express';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractActionItems } from './claude.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, '..', 'config.json');

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) return {};
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); } catch { return {}; }
}

function getOAuth2Client(cfg) {
  const oauth2 = new google.auth.OAuth2(
    cfg.googleClientId,
    cfg.googleClientSecret,
    'http://localhost:3001/auth/google/callback'
  );
  if (cfg.googleAccessToken) {
    oauth2.setCredentials({
      access_token: cfg.googleAccessToken,
      refresh_token: cfg.googleRefreshToken,
    });
  }
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

        // For Slack digest emails, extract the full body for better parsing
        const isSlackDigest = from.toLowerCase().includes('slack') ||
          subject.toLowerCase().includes('digest') ||
          subject.toLowerCase().includes('missed messages') ||
          subject.toLowerCase().includes('mention');

        let snippet = msg.snippet || '';
        if (isSlackDigest && msg.payload) {
          // Try to get plain text body
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
        };
      });

    // Use Claude to extract action items
    const actionItems = await extractActionItems(messages, 'gmail');

    const tasks = actionItems.map((item) => ({
      id: `gmail-${item.sourceId}`,
      sourceId: item.sourceId,
      title: item.title,
      description: item.description,
      source: 'gmail',
      status: 'todo',
      priority: item.priority || 'medium',
      dueDate: item.dueDate || undefined,
      url: `https://mail.google.com/mail/u/0/#inbox/${item.sourceId}`,
      updatedAt: new Date().toISOString(),
    }));

    res.json({ tasks });
  } catch (err) {
    console.error('Gmail error:', err.message);
    res.json({ tasks: [], error: err.message });
  }
});

export default router;
