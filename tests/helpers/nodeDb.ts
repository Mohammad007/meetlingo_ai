/* eslint-disable @typescript-eslint/no-require-imports */
import type { SqlDb, SqlParam } from '@/database/types';

/**
 * SqlDb backed by Node's built-in SQLite (node:sqlite), so repository tests execute the real SQL,
 * migrations, FTS5 and foreign keys exactly as on device (expo-sqlite also bundles SQLite with FTS5).
 */
export function createNodeDb(): SqlDb {
  const { DatabaseSync } = require('node:sqlite') as typeof import('node:sqlite');
  const db = new DatabaseSync(':memory:');
  let depth = 0;
  const self: SqlDb = {
    exec: async (sql) => {
      db.exec(sql);
    },
    run: async (sql, params: SqlParam[] = []) => {
      const r = db.prepare(sql).run(...params);
      return { changes: Number(r.changes), lastInsertRowId: Number(r.lastInsertRowid) };
    },
    all: async <T,>(sql: string, params: SqlParam[] = []) => db.prepare(sql).all(...params) as T[],
    first: async <T,>(sql: string, params: SqlParam[] = []) => (db.prepare(sql).get(...params) as T | undefined) ?? null,
    transaction: async <T,>(fn: (tx: SqlDb) => Promise<T>) => {
      if (depth > 0) return fn(self);
      depth++;
      db.exec('BEGIN IMMEDIATE');
      try {
        const r = await fn(self);
        db.exec('COMMIT');
        return r;
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      } finally {
        depth--;
      }
    },
    close: async () => db.close(),
  };
  return self;
}
