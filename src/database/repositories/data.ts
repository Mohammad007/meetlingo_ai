import type { SqlDb } from '../types';

/**
 * Deletes every meeting, transcript, summary, action item and glossary entry stored on this device.
 * Settings are reset except the onboarding flag when [keepOnboarding] is true.
 */
export async function clearAllData(db: SqlDb, opts: { keepOnboarding?: boolean } = {}) {
  await db.transaction(async (tx) => {
    await tx.run('DELETE FROM action_items');
    await tx.run('DELETE FROM meeting_summaries');
    await tx.run('DELETE FROM transcript_segments');
    await tx.run('DELETE FROM meetings');
    await tx.run('DELETE FROM glossary_entries');
    if (opts.keepOnboarding) {
      await tx.run("DELETE FROM app_settings WHERE key NOT IN ('onboarding_complete')");
    } else {
      await tx.run('DELETE FROM app_settings');
    }
  });
  // Rebuild the FTS index (no-op when FTS is unavailable) and reclaim space.
  try {
    await db.exec("INSERT INTO segments_fts(segments_fts) VALUES ('rebuild')");
  } catch {
    /* FTS not available */
  }
  await db.exec('VACUUM');
}

/** Deletes meetings older than [days] (retention policy). Returns ids removed. */
export async function applyRetention(db: SqlDb, days: number, now = Date.now()): Promise<string[]> {
  if (!days || days <= 0) return [];
  const cutoff = now - days * 86_400_000;
  const rows = await db.all<{ id: string }>(
    "SELECT id FROM meetings WHERE started_at < ? AND status NOT IN ('active','paused')",
    [cutoff],
  );
  if (rows.length) {
    await db.transaction(async (tx) => {
      for (const r of rows) await tx.run('DELETE FROM meetings WHERE id = ?', [r.id]);
    });
  }
  return rows.map((r) => r.id);
}

/** Quick SQLite health check for diagnostics: write, read back, delete inside a transaction. */
export async function sqliteSelfTest(db: SqlDb): Promise<{ ok: boolean; ms: number; error?: string }> {
  const t0 = Date.now();
  try {
    const key = `__diag_${t0}`;
    await db.transaction(async (tx) => {
      await tx.run('INSERT INTO app_settings (key, json_value, updated_at) VALUES (?, ?, ?)', [key, '"ok"', t0]);
      const r = await tx.first<{ json_value: string }>('SELECT json_value FROM app_settings WHERE key = ?', [key]);
      if (r?.json_value !== '"ok"') throw new Error('Read-back mismatch');
      await tx.run('DELETE FROM app_settings WHERE key = ?', [key]);
    });
    const fk = await db.first<{ foreign_keys: number }>('PRAGMA foreign_keys');
    if (!fk?.foreign_keys) throw new Error('Foreign keys are disabled');
    return { ok: true, ms: Date.now() - t0 };
  } catch (e) {
    return { ok: false, ms: Date.now() - t0, error: (e as Error).message };
  }
}

export async function databaseStats(db: SqlDb) {
  const c = async (sql: string) => (await db.first<{ n: number }>(sql))?.n ?? 0;
  const pageCount = (await db.first<{ page_count: number }>('PRAGMA page_count'))?.page_count ?? 0;
  const pageSize = (await db.first<{ page_size: number }>('PRAGMA page_size'))?.page_size ?? 0;
  return {
    meetings: await c('SELECT COUNT(*) AS n FROM meetings'),
    segments: await c('SELECT COUNT(*) AS n FROM transcript_segments'),
    glossary: await c('SELECT COUNT(*) AS n FROM glossary_entries'),
    actionItems: await c('SELECT COUNT(*) AS n FROM action_items'),
    sizeBytes: pageCount * pageSize,
  };
}
