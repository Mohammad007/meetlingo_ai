import type { InstalledModelRow } from '@/types';

import type { SqlDb } from '../types';

interface Row {
  model_id: string;
  model_kind: 'asr' | 'translation';
  model_version: string;
  local_path: string | null;
  sha256: string | null;
  size_bytes: number | null;
  verified: number;
  installed_at: number | null;
}

const map = (r: Row): InstalledModelRow => ({
  modelId: r.model_id,
  modelKind: r.model_kind,
  modelVersion: r.model_version,
  localPath: r.local_path,
  sha256: r.sha256,
  sizeBytes: r.size_bytes,
  verified: !!r.verified,
  installedAt: r.installed_at,
});

export async function listInstalledModels(db: SqlDb): Promise<InstalledModelRow[]> {
  return (await db.all<Row>('SELECT * FROM installed_models ORDER BY model_kind, model_id')).map(map);
}

export async function upsertInstalledModel(db: SqlDb, m: InstalledModelRow) {
  await db.run(
    `INSERT INTO installed_models (model_id, model_kind, model_version, local_path, sha256, size_bytes, verified, installed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(model_id) DO UPDATE SET model_kind = excluded.model_kind, model_version = excluded.model_version,
       local_path = excluded.local_path, sha256 = excluded.sha256, size_bytes = excluded.size_bytes,
       verified = excluded.verified, installed_at = excluded.installed_at`,
    [m.modelId, m.modelKind, m.modelVersion, m.localPath, m.sha256, m.sizeBytes, m.verified ? 1 : 0, m.installedAt],
  );
}

export async function removeInstalledModel(db: SqlDb, modelId: string) {
  await db.run('DELETE FROM installed_models WHERE model_id = ?', [modelId]);
}
