import type { GlossaryEntry } from '@/types';

import { LETTER_NAMES } from './lexicon';

export interface ProtectedSlot {
  token: string;
  /** Original English text as spoken (case preserved). */
  original: string;
  /** What to insert into the output for this slot. */
  output: string;
  ruleType: 'preserve_english' | 'translate_as';
}

export interface MaskResult {
  masked: string;
  slots: ProtectedSlot[];
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Word-boundary aware, case-insensitive regex for a phrase. Works for terms with symbols like "C++" or ".NET". */
export function phraseRegex(phrase: string, flags = 'gi'): RegExp {
  const body = phrase
    .trim()
    .split(/\s+/)
    .map(escapeRe)
    .join('\\s+');
  return new RegExp(`(?<![\\p{L}\\p{N}_])${body}(?![\\p{L}\\p{N}_])`, flags + 'u');
}

/** Placeholder token for slot i. Upper-case alphanumeric codes are normally copied verbatim by NMT. */
export const slotToken = (i: number) => `ZX${i}Q`;
const SLOT_RE = /Z\s?X\s?(\d+)\s?Q/gi;

/**
 * Replaces protected glossary phrases with placeholder tokens before translation.
 * Precedence: longer phrases first, then translate_as over preserve_english for identical phrases;
 * matches never overlap.
 */
export function maskProtectedTerms(english: string, glossary: GlossaryEntry[]): MaskResult {
  const rules = glossary
    .filter((g) => g.enabled && (g.ruleType === 'preserve_english' || g.ruleType === 'translate_as') && g.sourcePhrase.trim())
    .sort((a, b) => {
      const len = b.sourcePhrase.trim().length - a.sourcePhrase.trim().length;
      if (len !== 0) return len;
      return a.ruleType === 'translate_as' ? -1 : b.ruleType === 'translate_as' ? 1 : 0;
    });

  const taken: [number, number][] = [];
  const found: { start: number; end: number; rule: GlossaryEntry; text: string }[] = [];
  for (const rule of rules) {
    for (const m of english.matchAll(phraseRegex(rule.sourcePhrase))) {
      const start = m.index ?? 0;
      const end = start + m[0].length;
      if (taken.some(([s, e]) => start < e && end > s)) continue;
      taken.push([start, end]);
      found.push({ start, end, rule, text: m[0] });
    }
  }
  found.sort((a, b) => a.start - b.start);

  const slots: ProtectedSlot[] = [];
  let masked = '';
  let last = 0;
  found.forEach((f, i) => {
    const token = slotToken(i);
    masked += english.slice(last, f.start) + token;
    last = f.end;
    const preserve = f.rule.ruleType === 'preserve_english';
    slots.push({
      token,
      original: f.text,
      // Preserve the user's canonical casing for preserved terms (e.g. "api" spoken -> "API").
      output: preserve ? f.rule.sourcePhrase.trim() : f.rule.replacement.trim(),
      ruleType: f.rule.ruleType as ProtectedSlot['ruleType'],
    });
  });
  masked += english.slice(last);
  return { masked, slots };
}

/**
 * Restores placeholders in translated text. Returns ok=false if any placeholder was lost or duplicated,
 * in which case the caller must fall back to unmasked translation.
 */
export function restoreProtectedTerms(translated: string, slots: ProtectedSlot[]): { text: string; ok: boolean } {
  if (!slots.length) return { text: translated, ok: true };
  const seen = new Map<number, number>();
  const text = translated.replace(SLOT_RE, (_m, d: string) => {
    const i = Number(d);
    seen.set(i, (seen.get(i) ?? 0) + 1);
    return slots[i] ? slots[i].output : '';
  });
  const ok = slots.every((_, i) => seen.get(i) === 1);
  return { text, ok };
}

/** Devanagari spelling of an acronym as letters are spoken: "API" -> "एपीआई". */
export function spellAcronymDevanagari(acronym: string): string | null {
  if (!/^[A-Z]{2,6}$/.test(acronym)) return null;
  return Array.from(acronym)
    .map((c) => LETTER_NAMES[c])
    .join('');
}

/**
 * Fallback when placeholders did not survive translation: restore acronym terms that ML Kit spelled out in
 * Devanagari (e.g. "एपीआई" -> "API"). Loanwords such as "डैशबोर्ड" are restored later by the lexicon.
 */
export function restoreAcronymsInHindi(hindi: string, glossary: GlossaryEntry[]): string {
  let out = hindi;
  for (const g of glossary) {
    if (!g.enabled || g.ruleType !== 'preserve_english') continue;
    const spelled = spellAcronymDevanagari(g.sourcePhrase.trim());
    if (spelled) out = out.split(spelled).join(g.sourcePhrase.trim());
  }
  return out;
}
