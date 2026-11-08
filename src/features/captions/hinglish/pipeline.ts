import type { GlossaryEntry } from '@/types';

import { COLLOQUIAL, COMMON_SPELLINGS, LOANWORDS } from './lexicon';
import { maskProtectedTerms, phraseRegex, restoreAcronymsInHindi, restoreProtectedTerms } from './protect';
import { DEVANAGARI_RE, romanizeWord } from './romanize';

export type Translator = (text: string) => Promise<string>;

export interface HinglishResult {
  /** Devanagari Hindi (protected terms kept in Latin script). */
  hindi: string;
  /** Roman-script Hinglish line in the requested style. */
  hinglish: string;
  /** True when placeholder protection failed and the unmasked fallback path was used. */
  protectionFallback: boolean;
  protectedTerms: string[];
}

export interface RomanizeOptions {
  style: 'natural_hinglish' | 'simple_hinglish';
  glossary: GlossaryEntry[];
  /** Optional ICU transliterator (Android API 29+). Used only when preferIcu is true. */
  icu?: ((devanagari: string) => string | null) | null;
  preferIcu?: boolean;
}

const PUNCT_SPLIT = /(\s+|[.,!?;:"'()[\]…-])/;

/** Converts Devanagari Hindi (possibly mixed with Latin terms) to Roman-script Hinglish. */
export function hindiToHinglish(hindi: string, opts: RomanizeOptions): string {
  const overrides = opts.glossary.filter((g) => g.enabled && g.ruleType === 'romanization_override');
  const devOverrides = new Map<string, string>();
  const latinOverrides: GlossaryEntry[] = [];
  for (const o of overrides) {
    if (DEVANAGARI_RE.test(o.sourcePhrase)) devOverrides.set(o.sourcePhrase.trim().normalize('NFC'), o.replacement.trim());
    else latinOverrides.push(o);
  }

  const text = hindi.normalize('NFC').replace(/॥|।/g, '.');
  const tokens = text.split(PUNCT_SPLIT);
  const out = tokens.map((tok) => {
    if (!tok || !DEVANAGARI_RE.test(tok)) return tok;
    const o = devOverrides.get(tok);
    if (o) return o;
    if (LOANWORDS[tok]) return LOANWORDS[tok];
    if (opts.style === 'natural_hinglish' && COLLOQUIAL[tok]) return COLLOQUIAL[tok];
    if (COMMON_SPELLINGS[tok]) return COMMON_SPELLINGS[tok];
    if (opts.preferIcu && opts.icu) {
      const r = opts.icu(tok);
      if (r) return r.toLowerCase();
    }
    return romanizeWord(tok);
  });

  let result = out.join('');
  for (const o of latinOverrides.sort((a, b) => b.sourcePhrase.length - a.sourcePhrase.length)) {
    result = result.replace(phraseRegex(o.sourcePhrase), o.replacement.trim());
  }
  return tidy(result);
}

/** Spacing/punctuation cleanup and sentence capitalisation. */
export function tidy(s: string): string {
  let t = s
    .replace(/\s+([.,!?;:])/g, '$1')
    .replace(/([.,!?;:])(?=[^\s.,!?;:)"'\d])/g, '$1 ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  t = t.replace(/(^|[.!?]\s+)([a-z])/g, (_m, p: string, c: string) => p + c.toUpperCase());
  return t;
}

/**
 * Full EN -> HI -> Hinglish pipeline for one finalised English phrase.
 *  1. Mask glossary-protected terms with placeholders.
 *  2. Translate on-device (ML Kit).
 *  3. Restore placeholders; if any were lost, translate the unmasked text and restore acronyms instead.
 *  4. Romanise with loanword restoration, colloquial normalisation and user overrides.
 */
export async function translateToHinglish(
  english: string,
  translate: Translator,
  opts: RomanizeOptions,
): Promise<HinglishResult> {
  const source = english.trim();
  if (!source) return { hindi: '', hinglish: '', protectionFallback: false, protectedTerms: [] };

  const { masked, slots } = maskProtectedTerms(source, opts.glossary);
  let hindi: string;
  let protectionFallback = false;
  if (slots.length) {
    const translated = await translate(masked);
    const restored = restoreProtectedTerms(translated, slots);
    if (restored.ok) {
      hindi = restored.text;
    } else {
      protectionFallback = true;
      hindi = restoreAcronymsInHindi(await translate(source), opts.glossary);
    }
  } else {
    hindi = await translate(source);
  }
  const hinglish = hindiToHinglish(hindi, opts);
  return { hindi: hindi.trim(), hinglish, protectionFallback, protectedTerms: slots.map((s) => s.output) };
}
