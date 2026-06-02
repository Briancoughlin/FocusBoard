const BASE = '/api/persistence';

export async function getPersistedValue<T>(key: string, defaultValue: T): Promise<T> {
  try {
    const res = await fetch(`${BASE}/${key}`);
    const data = await res.json();
    return data.value !== null && data.value !== undefined ? data.value : defaultValue;
  } catch {
    return defaultValue;
  }
}

export async function setPersistedValue<T>(key: string, value: T): Promise<void> {
  try {
    await fetch(`${BASE}/${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    });
  } catch {
    // fail silently
  }
}
