import { migrations, type Migration } from './migrations';
import type { SqlDb } from './types';

export interface MigrationReport {
  fromVersion: number;
  toVersion: number;
  applied: string[];
  ftsAvailable: boolean;
  skippedOptional: { name: string; error: string }[];
}

async function currentVersion(db: SqlDb): Promise<number> {
  const row = await db.first<{ user_version: number }>('PRAGMA user_version');
  return row?.user_version ?? 0;
}

/**
 * Applies pending migrations in order, each in its own transaction, bumping PRAGMA user_version.
 * Optional migrations (FTS5) that fail are recorded and skipped so the app still starts with the
 * indexed LIKE fallback.
 */
export async function runMigrations(db: SqlDb, list: Migration[] = migrations): Promise<MigrationReport> {
  await db.exec('PRAGMA foreign_keys = ON');
  await db.exec('PRAGMA journal_mode = WAL');
  const from = await currentVersion(db);
  const applied: string[] = [];
  const skippedOptional: MigrationReport['skippedOptional'] = [];
  let version = from;

  for (const m of list) {
    if (m.version <= version) continue;
    try {
      await db.transaction(async (tx) => {
        for (const sql of m.statements) await tx.exec(sql);
        await tx.exec(`PRAGMA user_version = ${m.version}`);
      });
      applied.push(m.name);
    } catch (e) {
      if (!m.optional) throw new Error(`Migration ${m.version} (${m.name}) failed: ${(e as Error).message}`);
      skippedOptional.push({ name: m.name, error: (e as Error).message });
      await db.exec(`PRAGMA user_version = ${m.version}`);
    }
    version = m.version;
  }

  const fts = await db.first<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='segments_fts'",
  );
  return { fromVersion: from, toVersion: version, applied, ftsAvailable: !!fts, skippedOptional };
}
