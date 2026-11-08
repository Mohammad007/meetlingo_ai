/**
 * Minimal async SQL interface used by migrations and repositories.
 *
 * Production: backed by expo-sqlite (src/database/db.ts).
 * Tests: backed by Node's built-in `node:sqlite` (tests/helpers/nodeDb.ts), so the same SQL, migrations,
 * FTS5 and foreign-key behaviour are exercised in Jest without mocks.
 */
export type SqlParam = string | number | null;

export interface SqlRunResult {
  changes: number;
  lastInsertRowId: number;
}

export interface SqlDb {
  exec(sql: string): Promise<void>;
  run(sql: string, params?: SqlParam[]): Promise<SqlRunResult>;
  all<T>(sql: string, params?: SqlParam[]): Promise<T[]>;
  first<T>(sql: string, params?: SqlParam[]): Promise<T | null>;
  /** Runs [fn] inside an exclusive transaction; rolls back if it throws. */
  transaction<T>(fn: (tx: SqlDb) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
