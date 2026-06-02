import { Router } from 'express';
import { WebClient } from '@slack/web-api';
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

const router = Router();

router.get('/', async (req, res) => {
  const cfg = loadConfig();
  if (!cfg.slackToken) {
    return res.json({ tasks: [], error: 'Slack not configured' });
  }

  try {
    const slack = new WebClient(cfg.slackToken);

    // Get the bot's own user ID for mention searching
    const authInfo = await slack.auth.test();
    const userId = authInfo.user_id;

    const rawMessages = [];

    // 1. Fetch DM channels and their recent messages
    try {
      const imsRes = await slack.conversations.list({ types: 'im', limit: 10 });
      const dmChannels = (imsRes.channels || []).slice(0, 5);

      await Promise.allSettled(
        dmChannels.map(async (channel) => {
          try {
            const histRes = await slack.conversations.history({
              channel: channel.id,
              limit: 5,
            });
            for (const msg of histRes.messages || []) {
              if (msg.text && msg.user !== userId) {
                rawMessages.push({
                  id: `${channel.id}-${msg.ts}`,
                  subject: `DM from <@${msg.user || 'unknown'}>`,
                  from: msg.user || 'unknown',
                  date: new Date(parseFloat(msg.ts) * 1000).toISOString(),
                  snippet: msg.text.substring(0, 300),
                });
              }
            }
          } catch { /* skip channel on error */ }
        })
      );
    } catch (err) {
      console.warn('Slack DM fetch error:', err.message);
    }

    // 2. Search for mentions of the current user
    try {
      const mentionRes = await slack.search.messages({
        query: `<@${userId}>`,
        count: 10,
        sort: 'timestamp',
        sort_dir: 'desc',
      });
      for (const match of mentionRes.messages?.matches || []) {
        if (match.user !== userId) {
          rawMessages.push({
            id: match.ts,
            subject: `Mention in #${match.channel?.name || 'channel'}`,
            from: match.username || match.user || 'unknown',
            date: new Date(parseFloat(match.ts) * 1000).toISOString(),
            snippet: match.text.substring(0, 300),
          });
        }
      }
    } catch (err) {
      console.warn('Slack search error:', err.message);
    }

    if (rawMessages.length === 0) {
      return res.json({ tasks: [] });
    }

    let tasks = [];

    if (cfg.anthropicKey) {
      // Use Claude to extract action items
      const actionItems = await extractActionItems(rawMessages, 'slack');
      tasks = actionItems.map((item) => ({
        id: `slack-${item.sourceId}`,
        sourceId: item.sourceId,
        title: item.title,
        description: item.description,
        source: 'slack',
        status: 'todo',
        priority: item.priority || 'medium',
        dueDate: item.dueDate || undefined,
        url: undefined,
        updatedAt: new Date().toISOString(),
      }));
    } else {
      // Without Claude, create simple task cards from messages
      tasks = rawMessages.slice(0, 10).map((msg) => ({
        id: `slack-${msg.id}`,
        sourceId: msg.id,
        title: msg.subject,
        description: msg.snippet,
        source: 'slack',
        status: 'todo',
        priority: 'medium',
        dueDate: undefined,
        url: undefined,
        updatedAt: new Date().toISOString(),
      }));
    }

    res.json({ tasks });
  } catch (err) {
    console.error('Slack error:', err.message);
    res.json({ tasks: [], error: err.message });
  }
});

export default router;
