import { Router } from 'express';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
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

const router = Router();

router.get('/', async (req, res) => {
  const cfg = loadConfig();
  if (!cfg.googleClientId || !cfg.googleClientSecret || !cfg.googleAccessToken) {
    return res.json({ tasks: [], error: 'Google Calendar not configured' });
  }

  try {
    const auth = getOAuth2Client(cfg);
    const cal = google.calendar({ version: 'v3', auth });

    const now = new Date();
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const eventsRes = await cal.events.list({
      calendarId: 'primary',
      timeMin: now.toISOString(),
      timeMax: sevenDaysLater.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 30,
    });

    const events = eventsRes.data.items || [];

    const tasks = events
      .filter(event => event.status !== 'cancelled')
      .filter(event => !(event.location && !event.attendees?.length))
      .filter(event => event.eventType !== 'workingLocation')
      .filter(event => !(['home', 'office', 'unspecified'].includes(event.workingLocationProperties?.type?.toLowerCase?.() ?? '')))
      .map(event => {
        const start = event.start?.dateTime || event.start?.date;
        const isAllDay = !event.start?.dateTime;

        // Determine priority based on how soon the event is
        const startTime = new Date(start);
        const hoursUntil = (startTime - now) / (1000 * 60 * 60);
        let priority = 'low';
        if (hoursUntil < 24) priority = 'high';
        else if (hoursUntil < 72) priority = 'medium';

        return {
          id: `calendar-${event.id}`,
          sourceId: event.id,
          title: isAllDay
            ? `[All Day] ${event.summary || 'Untitled event'}`
            : `${event.summary || 'Untitled event'}`,
          description: event.description
            ? event.description.replace(/<[^>]+>/g, '').substring(0, 200)
            : event.location
              ? `Location: ${event.location}`
              : '',
          source: 'calendar',
          status: 'todo',
          priority,
          dueDate: start ? new Date(start).toISOString().split('T')[0] : undefined,
          url: event.htmlLink || undefined,
          updatedAt: new Date().toISOString(),
        };
      });

    res.json({ tasks });
  } catch (err) {
    console.error('Calendar error:', err.message);
    res.json({ tasks: [], error: err.message });
  }
});

export default router;
