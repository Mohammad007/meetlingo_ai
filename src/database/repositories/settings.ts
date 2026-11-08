import type { SqlDb } from '../types';

export async function getSetting<T>(db: SqlDb, key: string): Promise<T | null> {
  const r = await db.first<{ json_value: string }>('SELECT json_value FROM app_settings WHERE key = ?', [key]);
  if (!r) return null;
  try {
    return JSON.parse(r.json_value) as T;
  } catch {
    return null;
  }
}

export async function setSetting(db: SqlDb, key: string, value: unknown, now = Date.now()) {
  await db.run(
    `INSERT INTO app_settings (key, json_value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET json_value = excluded.json_value, updated_at = excluded.updated_at`,
    [key, JSON.stringify(value), now],
  );
}

export async function getAllSettings(db: SqlDb): Promise<Record<string, unknown>> {
  const rows = await db.all<{ key: string; json_value: string }>('SELECT key, json_value FROM app_settings');
  const out: Record<string, unknown> = {};
  for (const r of rows) {
    try {
      out[r.key] = JSON.parse(r.json_value);
    } catch {
      /* ignore corrupt value */
    }
  }
  return out;
}
