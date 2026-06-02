import type { Config, SyncResult } from '../types';

const BASE = '/api';

export async function syncAll(): Promise<SyncResult> {
  const res = await fetch(`${BASE}/sync`);
  if (!res.ok) throw new Error(`Sync failed: ${res.statusText}`);
  return res.json();
}

export async function fetchJira() {
  const res = await fetch(`${BASE}/jira`);
  return res.json();
}

export async function fetchGmail() {
  const res = await fetch(`${BASE}/gmail`);
  return res.json();
}

export async function fetchCalendar() {
  const res = await fetch(`${BASE}/calendar`);
  return res.json();
}

export async function fetchSlack() {
  const res = await fetch(`${BASE}/slack`);
  return res.json();
}

export async function getConfig(): Promise<Config> {
  const res = await fetch(`${BASE}/config`);
  if (!res.ok) throw new Error('Failed to load config');
  return res.json();
}

export async function saveConfig(config: Partial<Config>): Promise<void> {
  const res = await fetch(`${BASE}/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error('Failed to save config');
}

export function getGoogleAuthUrl(): string {
  return '/auth/google';
}
