import { getDb } from '@/database/db';
import { listGlossary } from '@/database/repositories/glossary';
import type { GlossaryEntry } from '@/types';

let cache: GlossaryEntry[] | null = null;
const listeners = new Set<() => void>();

/** Enabled glossary entries, cached in memory for the caption pipeline. */
export async function getActiveGlossary(): Promise<GlossaryEntry[]> {
  if (!cache) cache = await listGlossary(getDb(), { enabledOnly: true });
  return cache;
}

/** Call after any glossary change; live sessions pick up the new rules on the next caption. */
export function invalidateGlossary() {
  cache = null;
  listeners.forEach((l) => l());
}

export function onGlossaryChanged(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
