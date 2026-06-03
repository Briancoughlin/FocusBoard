import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Anthropic from '@anthropic-ai/sdk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, '..', 'config.json');

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) return {};
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); } catch { return {}; }
}

const router = Router();

router.post('/', async (req, res) => {
  const { text, source = 'paste' } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: 'No text provided' });

  const cfg = loadConfig();
  if (!cfg.anthropicKey) {
    // Parse Zoom-style checklists and bullet points without AI
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const items = lines
      .map(line => line.replace(/^(\[.\]|[-*•]|\d+\.)\s*/, '').trim())
      .filter(line => line.length > 3);

    const tasks = items.map((item, i) => ({
      id: `paste-${Date.now()}-${i}`,
      sourceId: `paste-${Date.now()}-${i}`,
      title: item.slice(0, 120),
      source: 'paste',
      status: 'todo',
      priority: 'medium',
      updatedAt: new Date().toISOString(),
    }));

    return res.json({ tasks: tasks.length ? tasks : [{
      id: `paste-${Date.now()}`, sourceId: `paste-${Date.now()}`,
      title: text.slice(0, 120), source: 'paste', status: 'todo', priority: 'medium', updatedAt: new Date().toISOString()
    }]});
  }

  try {
    const clientOptions = { apiKey: cfg.anthropicKey };
    if (cfg.anthropicBaseUrl) clientOptions.baseURL = cfg.anthropicBaseUrl;
    const client = new Anthropic(clientOptions);

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `Extract all action items and tasks from the following text. Return ONLY a JSON array of objects with these fields:
- title: short action item title (max 100 chars, start with a verb)
- description: brief context (max 200 chars, optional)
- priority: "high", "medium", or "low"
- dueDate: ISO date string if mentioned, otherwise omit

Return only the JSON array, no other text.

Text to process:
${text}`,
      }],
    });

    const raw = message.content[0].text.trim();
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('No JSON array in response');

    const items = JSON.parse(jsonMatch[0]);
    const tasks = items.map((item, i) => ({
      id: `paste-${Date.now()}-${i}`,
      sourceId: `paste-${Date.now()}-${i}`,
      title: item.title || 'Action item',
      description: item.description || '',
      source: 'paste',
      status: 'todo',
      priority: item.priority || 'medium',
      dueDate: item.dueDate || undefined,
      updatedAt: new Date().toISOString(),
    }));

    res.json({ tasks });
  } catch (err) {
    console.error('Paste extract error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
