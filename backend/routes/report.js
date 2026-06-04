import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { decryptConfig } from '../crypto-utils.js';

const router = express.Router();
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

function buildPlainTextReport(tasks, period) {
  const prefix = period === 'week' ? 'This week I completed' : 'Today I completed';
  const done = tasks.filter(t => t.status === 'done');
  const wontdo = tasks.filter(t => t.status === 'wontdo');

  if (done.length === 0 && wontdo.length === 0) {
    return `${prefix} 0 tasks.`;
  }

  const lines = [`${prefix} ${done.length} task${done.length !== 1 ? 's' : ''}:`];
  lines.push('');

  for (const t of done) {
    const key = t.ticketKey ? `${t.ticketKey} ` : '';
    const src = t.source !== 'jira' ? ` (${t.source})` : '';
    lines.push(`• ${key}${t.title}${src}`);
  }

  if (wontdo.length > 0) {
    lines.push('');
    lines.push(`**Won't Do (${wontdo.length}):**`);
    for (const t of wontdo) {
      const key = t.ticketKey ? `${t.ticketKey} ` : '';
      const reason = t.description ? ` - ${t.description}` : '';
      lines.push(`• ${key}${t.title}${reason}`);
    }
  }

  return lines.join('\n');
}

router.post('/', async (req, res) => {
  const { tasks, period } = req.body;

  if (!Array.isArray(tasks)) {
    return res.status(400).json({ error: 'tasks must be an array' });
  }

  const cfg = loadConfig();

  if (!cfg.anthropicKey) {
    const report = buildPlainTextReport(tasks, period);
    return res.json({ report, aiGenerated: false });
  }

  const clientOptions = { apiKey: cfg.anthropicKey };
  if (cfg.anthropicBaseUrl) clientOptions.baseURL = cfg.anthropicBaseUrl;
  const client = new Anthropic(clientOptions);

  // Build structured task list for the prompt
  const taskLines = tasks.map(t => {
    const parts = [];
    parts.push(`status: ${t.status}`);
    if (t.ticketKey) parts.push(`key: ${t.ticketKey}`);
    parts.push(`title: ${t.title}`);
    if (t.description) parts.push(`description: ${t.description}`);
    parts.push(`source: ${t.source}`);
    if (t.fixVersion) parts.push(`fixVersion: ${t.fixVersion}`);
    return parts.join(' | ');
  }).join('\n');

  const periodLabel = period === 'week' ? 'this week' : 'today';

  const systemPrompt = `You are a senior chief of staff writing executive-ready progress updates for a Product Manager at a tech company.

Write in first person, past tense. The tone should be confident, outcome-focused and professional — suitable for sharing with senior leadership or in a team update. Avoid task-list language like "I completed" or "I worked on". Instead lead with impact and outcomes.

Format rules:
- Open with a 1-2 sentence executive summary of the period's key themes and outcomes (no bullet, just prose)
- Then group delivered work under bold headers by theme or epic — NOT by source. E.g. **New User Onboarding**, **Data Strategy**, **Team Operations**
- Use Jira ticket keys where available: e.g. [CSD-554]
- Each bullet should read as an outcome or deliverable, not a task. E.g. "Delivered NUO activation dashboard in Amplitude [CSD-554]" not "Completed dashboard task"
- If descriptions add useful context, weave them in naturally
- Add a **Deprioritised** section at the end for Won't Do items with a one-line rationale if available
- Maximum 250 words total
- Do not invent or embellish. Only use info provided.`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Write an executive progress update for ${periodLabel}. Here are the completed and deprioritised items:\n\n${taskLines}`,
        },
      ],
    });

    const report = response.content[0]?.type === 'text' ? response.content[0].text : buildPlainTextReport(tasks, period);
    return res.json({ report, aiGenerated: true });
  } catch (err) {
    console.error('Report generation error:', err.message);
    const report = buildPlainTextReport(tasks, period);
    return res.json({ report, aiGenerated: false, error: err.message });
  }
});

export default router;
