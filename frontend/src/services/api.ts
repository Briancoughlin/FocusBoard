import type { Config, SyncResult } from '../types';

const BASE = '/api';

// All fetch calls include credentials so the auth cookie is always sent
const OPTS: RequestInit = { credentials: 'include' };

export async function syncAll(): Promise<SyncResult> {
  const res = await fetch(`${BASE}/sync`, OPTS);
  if (!res.ok) throw new Error(`Sync failed: ${res.statusText}`);
  return res.json();
}

export async function fetchJira() {
  const res = await fetch(`${BASE}/jira`, OPTS);
  return res.json();
}

export async function fetchGmail() {
  const res = await fetch(`${BASE}/gmail`, OPTS);
  return res.json();
}

export async function fetchCalendar() {
  const res = await fetch(`${BASE}/calendar`, OPTS);
  return res.json();
}

export async function fetchSlack() {
  const res = await fetch(`${BASE}/slack`, OPTS);
  return res.json();
}

export async function getConfig(): Promise<Config> {
  const res = await fetch(`${BASE}/config`, OPTS);
  if (!res.ok) throw new Error('Failed to load config');
  return res.json();
}

export async function saveConfig(config: Partial<Config>): Promise<void> {
  const res = await fetch(`${BASE}/config`, {
    ...OPTS,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error('Failed to save config');
}

export function getGoogleAuthUrl(): string {
  return '/auth/google';
}

export async function transitionJiraTicket(issueKey: string, targetStatus: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch('/api/jira/transition', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ issueKey, targetStatus }),
    });
    return res.json();
  } catch {
    return { success: false, error: 'Network error' };
  }
}
