import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { decryptConfig } from '../crypto-utils.js';
import { E } from '../error-codes.js';

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
 * Extract action items from a batch of messages using Claude.
 * @param {Array<{id: string, subject: string, snippet: string, from: string, date: string}>} messages
 * @param {'gmail'|'slack'} sourceType
 * @param {Array<{pattern: string, type: 'sender'|'subject', falsePositiveRate: number}>} [noisePatterns]
 * @returns {Promise<Array<{sourceId: string, title: string, description: string, dueDate?: string, priority: string, confidence: number}>>}
 */
export async function extractActionItems(messages, sourceType = 'gmail', noisePatterns = []) {
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

  // Build noise pattern instructions if we have learned patterns
  const noiseSection = noisePatterns.length > 0
    ? `\nLEARNED NOISE PATTERNS (user has marked these as not actionable — be extra sceptical):\n${
        noisePatterns.map(p => `- ${p.type === 'sender' ? 'From' : 'Subject contains'}: "${p.pattern}" (${Math.round(p.falsePositiveRate * 100)}% false positive rate)`).join('\n')
      }\n`
    : '';

  const systemPrompt = `You are an assistant that extracts concrete action items from emails and Slack notification digests for an ADHD user.

IMPORTANT: Slack sends daily digest emails with subjects like "Your daily digest", "Missed messages", or "You have mentions". These contain multiple Slack messages bundled together. Treat each individual Slack message within a digest as a separate potential action item.

For each message or Slack notification, determine if it requires an action from the recipient.${noiseSection}

Return a JSON array of action items. Each item must have:
- sourceId: the message ID from the input
- title: concise action title (max 80 chars), start with a verb (e.g. "Reply to...", "Review...", "Follow up with...", "Respond to...")
- description: 1-2 sentences — who asked, what they need, which Slack channel if applicable
- dueDate: ISO date string if a deadline is mentioned, otherwise null
- priority: "high" | "medium" | "low" based on urgency/importance
- isSlackDigest: true if this came from a Slack notification email, false otherwise
- confidence: number 0.0–1.0 — how certain you are this is a genuine action item the user needs to act on
  (0.9–1.0 = clearly actionable direct ask; 0.6–0.89 = probably needs attention; 0.3–0.59 = possibly relevant; below 0.3 = skip it entirely)

Guidelines:
- Slack mentions asking questions = high priority, confidence 0.9+
- Slack DMs = high priority, confidence 0.85+
- Slack FYI messages with no question = skip (confidence < 0.3)
- Regular emails asking for review/approval/input = medium-high priority, confidence 0.7–0.9
- Newsletters, automated alerts, CC'd emails with no direct ask = skip (confidence < 0.3)
- If a Slack digest contains 3 mentions, create 3 separate action items each with the same sourceId
- Only return items with confidence >= 0.3; skip the rest entirely

Return ONLY valid JSON array, no markdown, no explanation.`;

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
