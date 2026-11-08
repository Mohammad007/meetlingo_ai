import * as SQLite from 'expo-sqlite';

import { runMigrations, type MigrationReport } from './migrate';
import type { SqlDb, SqlParam } from './types';

export const DB_NAME = 'meetlingo.db';

type ExpoDb = SQLite.SQLiteDatabase;

function wrap(db: ExpoDb, inTx = false): SqlDb {
  const self: SqlDb = {
    exec: (sql) => db.execAsync(sql),
    run: async (sql, params: SqlParam[] = []) => {
      const r = await db.runAsync(sql, params);
      return { changes: r.changes, lastInsertRowId: r.lastInsertRowId };
    },
    all: <T,>(sql: string, params: SqlParam[] = []) => db.getAllAsync<T>(sql, params),
    first: <T,>(sql: string, params: SqlParam[] = []) => db.getFirstAsync<T>(sql, params),
    transaction: async <T,>(fn: (tx: SqlDb) => Promise<T>) => {
      if (inTx) return fn(self);
      let result: T | undefined;
      await db.withExclusiveTransactionAsync(async (txn) => {
        result = await fn(wrap(txn as unknown as ExpoDb, true));
      });
      return result as T;
    },
    close: () => db.closeAsync(),
  };
  return self;
}

let instance: SqlDb | null = null;
let opening: Promise<{ db: SqlDb; report: MigrationReport }> | null = null;
let lastReport: MigrationReport | null = null;

/** Opens the on-device database once and runs migrations. */
export function openAppDatabase(): Promise<{ db: SqlDb; report: MigrationReport }> {
  if (instance && lastReport) return Promise.resolve({ db: instance, report: lastReport });
  if (!opening) {
    opening = (async () => {
      const raw = await SQLite.openDatabaseAsync(DB_NAME);
      const db = wrap(raw);
      const report = await runMigrations(db);
      instance = db;
      lastReport = report;
      return { db, report };
    })().catch((e) => {
      opening = null;
      throw e;
    });
  }
  return opening;
}

export function getDb(): SqlDb {
  if (!instance) throw new Error('Database not opened yet. Call openAppDatabase() during startup.');
  return instance;
}

export function getMigrationReport(): MigrationReport | null {
  return lastReport;
}

/** For tests: inject an alternative SqlDb implementation. */
export function setDbForTesting(db: SqlDb | null, report?: MigrationReport) {
  instance = db;
  lastReport = report ?? null;
  opening = null;
}

export async function closeAppDatabase() {
  const db = instance;
  instance = null;
  opening = null;
  if (db) await db.close();
}
