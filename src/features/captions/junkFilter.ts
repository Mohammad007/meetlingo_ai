/**
 * Drops "junk" finals that carry no meeting content: filler-only utterances ("uh", "hmm", "okay okay")
 * and very short single-token outputs typically produced by a cough, a door or keyboard noise.
 * Real one-word answers ("Yes.", "Done.") are kept. Dropped captions are counted in local telemetry.
 */
const FILLERS = new Set([
  'uh', 'um', 'umm', 'uhh', 'hmm', 'hm', 'mm', 'mhm', 'ah', 'ahh', 'oh', 'eh', 'er', 'erm', 'huh', 'the', 'a', 'and', 'so',
]);

const KEEP_SHORT = new Set(['yes', 'no', 'yeah', 'yep', 'nope', 'okay', 'ok', 'done', 'sure', 'right', 'correct', 'thanks', 'hello', 'hi', 'bye', 'stop', 'agreed']);

export function isJunkCaption(text: string, durationMs?: number | null): boolean {
  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}' ]+/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return true;
  if (words.every((w) => FILLERS.has(w))) return true;
  if (words.length === 1) {
    const w = words[0];
    if (KEEP_SHORT.has(w)) return false;
    // A lone 1–2 letter token, or a single word shorter than 250 ms, is almost always noise.
    if (w.length <= 2) return true;
    if (durationMs != null && durationMs < 250) return true;
  }
  return false;
}
