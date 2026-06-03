import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, '..', 'config.json');

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) return {};
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); } catch { return {}; }
}

/**
 * Extract action items from a batch of messages using Claude.
 * @param {Array<{id: string, subject: string, snippet: string, from: string, date: string}>} messages
 * @param {'gmail'|'slack'} sourceType
 * @returns {Promise<Array<{sourceId: string, title: string, description: string, dueDate?: string, priority: string}>>}
 */
export async function extractActionItems(messages, sourceType = 'gmail') {
  const cfg = loadConfig();
  if (!cfg.anthropicKey) {
    throw new Error('Anthropic API key not configured');
  }

  const clientOptions = { apiKey: cfg.anthropicKey };
  if (cfg.anthropicBaseUrl) {
    clientOptions.baseURL = cfg.anthropicBaseUrl;
  }
  const client = new Anthropic(clientOptions);

  const messageList = messages
    .map((m, i) => `[${i + 1}] ID:${m.id} | From: ${m.from} | Date: ${m.date} | Subject: ${m.subject}\nSnippet: ${m.snippet}`)
    .join('\n\n');

  const systemPrompt = `You are an assistant that extracts concrete action items from ${sourceType === 'gmail' ? 'emails' : 'Slack messages'}.
For each message, determine if it requires an action from the recipient.
Return a JSON array of action items. Each item must have:
- sourceId: the message ID from the input
- title: concise action title (max 80 chars), start with a verb (e.g. "Reply to...", "Review...", "Send...")
- description: 1-2 sentences about what needs to be done and who asked
- dueDate: ISO date string if a deadline is mentioned, otherwise null
- priority: "high" | "medium" | "low" based on urgency/importance

Only include messages that genuinely require action. Skip newsletters, automated notifications, FYI messages.
Return ONLY valid JSON, no markdown, no explanation.`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `Extract action items from these ${sourceType} messages:\n\n${messageList}`,
      },
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';

  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // Try to find JSON array in the response
    const match = text.match(/\[[\s\S]*\]/);
    if (match) {
      try { return JSON.parse(match[0]); } catch { /* fall through */ }
    }
    console.error('Claude response parse error. Raw:', text.substring(0, 200));
    return [];
  }
}
