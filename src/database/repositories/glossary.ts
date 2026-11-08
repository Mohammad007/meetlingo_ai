import type { GlossaryEntry, GlossaryRuleType } from '@/types';
import { uuid } from '@/utils/id';

import type { SqlDb } from '../types';

interface GlossaryRow {
  id: string;
  source_phrase: string;
  replacement: string;
  rule_type: GlossaryRuleType;
  enabled: number;
  updated_at: number;
}

const map = (r: GlossaryRow): GlossaryEntry => ({
  id: r.id,
  sourcePhrase: r.source_phrase,
  replacement: r.replacement,
  ruleType: r.rule_type,
  enabled: !!r.enabled,
  updatedAt: r.updated_at,
});

/** Starter vocabulary from the product spec. Inserted once; users can edit or delete them. */
export const DEFAULT_GLOSSARY: { sourcePhrase: string; replacement: string; ruleType: GlossaryRuleType }[] = [
  { sourcePhrase: 'API', replacement: 'API', ruleType: 'preserve_english' },
  { sourcePhrase: 'SDK', replacement: 'SDK', ruleType: 'preserve_english' },
  { sourcePhrase: 'React Native', replacement: 'React Native', ruleType: 'preserve_english' },
  { sourcePhrase: 'APK', replacement: 'APK', ruleType: 'preserve_english' },
  { sourcePhrase: 'dashboard', replacement: 'dashboard', ruleType: 'preserve_english' },
  { sourcePhrase: 'deployment', replacement: 'deployment', ruleType: 'preserve_english' },
  { sourcePhrase: 'retest', replacement: 'retest', ruleType: 'preserve_english' },
  { sourcePhrase: 'build', replacement: 'build', ruleType: 'preserve_english' },
  { sourcePhrase: 'testing', replacement: 'testing', ruleType: 'preserve_english' },
  { sourcePhrase: 'bug', replacement: 'bug', ruleType: 'preserve_english' },
  { sourcePhrase: 'server', replacement: 'server', ruleType: 'preserve_english' },
  { sourcePhrase: 'database', replacement: 'database', ruleType: 'preserve_english' },
  { sourcePhrase: 'release', replacement: 'release', ruleType: 'preserve_english' },
  { sourcePhrase: 'meeting', replacement: 'meeting', ruleType: 'preserve_english' },
  { sourcePhrase: 'deadline', replacement: 'deadline', ruleType: 'preserve_english' },
  { sourcePhrase: 'feedback', replacement: 'feedback', ruleType: 'preserve_english' },
];

export async function seedDefaultGlossary(db: SqlDb, now = Date.now()) {
  const seeded = await db.first<{ json_value: string }>("SELECT json_value FROM app_settings WHERE key = 'glossary_seeded'");
  if (seeded) return false;
  await db.transaction(async (tx) => {
    for (const g of DEFAULT_GLOSSARY) {
      await tx.run(
        `INSERT OR IGNORE INTO glossary_entries (id, source_phrase, replacement, rule_type, enabled, updated_at)
         VALUES (?, ?, ?, ?, 1, ?)`,
        [uuid(), g.sourcePhrase, g.replacement, g.ruleType, now],
      );
    }
    await tx.run(
      "INSERT OR REPLACE INTO app_settings (key, json_value, updated_at) VALUES ('glossary_seeded', 'true', ?)",
      [now],
    );
  });
  return true;
}

export async function listGlossary(db: SqlDb, opts: { enabledOnly?: boolean } = {}): Promise<GlossaryEntry[]> {
  const rows = await db.all<GlossaryRow>(
    `SELECT * FROM glossary_entries ${opts.enabledOnly ? 'WHERE enabled = 1' : ''} ORDER BY source_phrase COLLATE NOCASE`,
  );
  return rows.map(map);
}

export interface GlossaryInput {
  sourcePhrase: string;
  replacement: string;
  ruleType: GlossaryRuleType;
  enabled?: boolean;
}

export function validateGlossary(input: GlossaryInput): string | null {
  const src = input.sourcePhrase.trim();
  if (!src) return 'Enter the phrase to match.';
  if (src.length > 80) return 'Phrase is too long (max 80 characters).';
  if (input.ruleType !== 'preserve_english' && !input.replacement.trim()) return 'Enter the replacement text.';
  return null;
}

export async function saveGlossaryEntry(db: SqlDb, input: GlossaryInput & { id?: string }, now = Date.now()) {
  const err = validateGlossary(input);
  if (err) throw new Error(err);
  const replacement = input.ruleType === 'preserve_english' ? input.sourcePhrase.trim() : input.replacement.trim();
  const dup = await db.first<{ id: string }>(
    'SELECT id FROM glossary_entries WHERE lower(source_phrase) = lower(?) AND rule_type = ? AND id != ?',
    [input.sourcePhrase.trim(), input.ruleType, input.id ?? ''],
  );
  if (dup) throw new Error('An entry for this phrase and rule already exists.');
  if (input.id) {
    await db.run(
      'UPDATE glossary_entries SET source_phrase = ?, replacement = ?, rule_type = ?, enabled = ?, updated_at = ? WHERE id = ?',
      [input.sourcePhrase.trim(), replacement, input.ruleType, input.enabled === false ? 0 : 1, now, input.id],
    );
    return input.id;
  }
  const id = uuid();
  await db.run(
    'INSERT INTO glossary_entries (id, source_phrase, replacement, rule_type, enabled, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    [id, input.sourcePhrase.trim(), replacement, input.ruleType, input.enabled === false ? 0 : 1, now],
  );
  return id;
}

export async function setGlossaryEnabled(db: SqlDb, id: string, enabled: boolean, now = Date.now()) {
  await db.run('UPDATE glossary_entries SET enabled = ?, updated_at = ? WHERE id = ?', [enabled ? 1 : 0, now, id]);
}

export async function deleteGlossaryEntry(db: SqlDb, id: string) {
  await db.run('DELETE FROM glossary_entries WHERE id = ?', [id]);
}
