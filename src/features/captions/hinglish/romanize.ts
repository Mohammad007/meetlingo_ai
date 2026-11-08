/**
 * Rule-based Devanagari -> Roman Hindi (Hinglish spelling) transliterator with schwa deletion.
 *
 * This produces readable chat-style spellings ("samajhna", "kamal", "mitra") rather than the scholarly
 * ISO-15919 output of ICU ("samajhanā"). It is deterministic and unit tested; it is NOT a language model.
 */

const CONSONANTS: Record<string, string> = {
  क: 'k', ख: 'kh', ग: 'g', घ: 'gh', ङ: 'n', च: 'ch', छ: 'chh', ज: 'j', झ: 'jh', ञ: 'n',
  ट: 't', ठ: 'th', ड: 'd', ढ: 'dh', ण: 'n', त: 't', थ: 'th', द: 'd', ध: 'dh', न: 'n',
  प: 'p', फ: 'ph', ब: 'b', भ: 'bh', म: 'm', य: 'y', र: 'r', ल: 'l', व: 'v', श: 'sh',
  ष: 'sh', स: 's', ह: 'h', ळ: 'l',
  // precomposed nukta letters
  क़: 'q', ख़: 'kh', ग़: 'gh', ज़: 'z', ड़: 'd', ढ़: 'dh', फ़: 'f', य़: 'y',
};

/** Consonant + combining nukta (U+093C). */
const NUKTA_FORMS: Record<string, string> = {
  क: 'q', ख: 'kh', ग: 'gh', ज: 'z', ड: 'd', ढ: 'dh', फ: 'f', य: 'y',
};

const INDEPENDENT_VOWELS: Record<string, string> = {
  अ: 'a', आ: 'aa', इ: 'i', ई: 'ee', उ: 'u', ऊ: 'oo', ऋ: 'ri', ए: 'e', ऐ: 'ai', ओ: 'o', औ: 'au',
  ऑ: 'o', ऍ: 'e', ऎ: 'e', ऒ: 'o',
};

const MATRAS: Record<string, string> = {
  'ा': 'aa', 'ि': 'i', 'ी': 'ee', 'ु': 'u', 'ू': 'oo', 'ृ': 'ri', 'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au',
  'ॉ': 'o', 'ॅ': 'e', 'ॆ': 'e', 'ॊ': 'o',
};

const VIRAMA = '्';
const NUKTA = '़';
const ANUSVARA = 'ं';
const CHANDRABINDU = 'ँ';
const VISARGA = 'ः';
const DIGITS: Record<string, string> = { '०': '0', '१': '1', '२': '2', '३': '3', '४': '4', '५': '5', '६': '6', '७': '7', '८': '8', '९': '9' };

interface Unit {
  c: string | null; // romanised consonant (null for independent vowel)
  v: string | 'INHERENT' | 'NONE';
  nasal: boolean;
  deleted?: boolean;
}

export const DEVANAGARI_RE = /[ऀ-ॿ]/;

function parseWord(word: string): { units: Unit[]; tail: string } {
  const units: Unit[] = [];
  let tail = '';
  const chars = Array.from(word.normalize('NFC'));
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const next = chars[i + 1];
    if (CONSONANTS[ch] !== undefined) {
      let c = CONSONANTS[ch];
      if (next === NUKTA) {
        c = NUKTA_FORMS[ch] ?? c;
        i++;
      }
      units.push({ c, v: 'INHERENT', nasal: false });
    } else if (MATRAS[ch] !== undefined) {
      const last = units[units.length - 1];
      if (last && last.c && last.v === 'INHERENT') last.v = MATRAS[ch];
      else units.push({ c: null, v: MATRAS[ch], nasal: false });
    } else if (ch === VIRAMA) {
      const last = units[units.length - 1];
      if (last) last.v = 'NONE';
    } else if (INDEPENDENT_VOWELS[ch] !== undefined) {
      units.push({ c: null, v: INDEPENDENT_VOWELS[ch], nasal: false });
    } else if (ch === ANUSVARA || ch === CHANDRABINDU) {
      const last = units[units.length - 1];
      if (last) last.nasal = true;
    } else if (ch === VISARGA) {
      units.push({ c: 'h', v: 'NONE', nasal: false });
    } else if (DIGITS[ch] !== undefined) {
      tail += DIGITS[ch];
    } else if (ch === NUKTA || ch === '‍' || ch === '‌') {
      // stray nukta / joiners: ignore
    } else {
      tail += ch;
    }
  }
  return { units, tail };
}

const hasVowel = (u: Unit | undefined) => !!u && !u.deleted && u.v !== 'NONE';

/** Classic Hindi schwa-deletion heuristic (right-to-left, V C [a] C V context + word-final rule). */
function applySchwaDeletion(units: Unit[]) {
  const n = units.length;
  if (n <= 1) return;
  const last = units[n - 1];
  // Word-final schwa: deleted, except after a conjunct ending in r/y/v (mitra, satya, mantra) where it is spoken.
  if (last.c && last.v === 'INHERENT' && !last.nasal) {
    const prev = units[n - 2];
    const conjunct = prev && prev.v === 'NONE';
    if (!conjunct || !/^(r|y|v)$/.test(last.c)) last.deleted = true;
  }
  for (let i = n - 2; i >= 1; i--) {
    const u = units[i];
    if (!u.c || u.v !== 'INHERENT' || u.nasal) continue;
    const prev = units[i - 1];
    const next = units[i + 1];
    if (hasVowel(prev) && next?.c && hasVowel(next) && prev.v !== 'NONE') {
      // Avoid creating a 3-consonant cluster: previous unit must not itself be part of a conjunct.
      const prevPrev = units[i - 2];
      if (prevPrev && prevPrev.v === 'NONE') continue;
      u.deleted = true;
    }
  }
}

function renderUnits(units: Unit[]): string {
  let out = '';
  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    if (u.c) out += u.c;
    if (u.v === 'NONE') {
      // no vowel
    } else if (u.v === 'INHERENT') {
      if (!u.deleted) out += 'a';
    } else {
      out += u.v;
    }
    if (u.nasal) {
      const nextC = units[i + 1]?.c ?? '';
      out += /^(p|b|bh|m)$/.test(nextC) ? 'm' : 'n';
    }
  }
  return out;
}

/** Chat-style smoothing: final "aa" -> "a", final "ee" -> "i", "jn" (ज्ञ) -> "gy". */
function smooth(word: string): string {
  let w = word.replace(/jn/g, 'gy');
  if (w.length > 2) {
    w = w.replace(/aa$/, 'a').replace(/ee$/, 'i');
  }
  return w;
}

/** Transliterates one Devanagari word. Non-Devanagari characters are passed through. */
export function romanizeWord(word: string): string {
  if (!DEVANAGARI_RE.test(word)) return word;
  const { units, tail } = parseWord(word);
  applySchwaDeletion(units);
  return smooth(renderUnits(units)) + tail;
}

/** Transliterates a whole Devanagari string, converting the danda to a full stop. */
export function romanizeText(text: string): string {
  return text
    .replace(/॥/g, '.')
    .replace(/।/g, '.')
    .split(/(\s+|[.,!?;:"'()\[\]-])/)
    .map((tok) => romanizeWord(tok))
    .join('');
}
