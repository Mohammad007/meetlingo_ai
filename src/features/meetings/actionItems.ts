/**
 * Heuristic action-item suggestions.
 *
 * Only captions containing an explicit request or commitment phrase are suggested, and the suggested task
 * text is the caption itself (lightly trimmed). Assignees and due dates are NEVER inferred — the user adds
 * them. Every suggestion is shown as "Review suggested task" until the user edits or accepts it.
 */

export interface ActionSource {
  segmentId: string;
  text: string;
}

export interface ActionSuggestion {
  sourceSegmentId: string;
  taskText: string;
  trigger: string;
}

/** Ordered: first match wins. Each pattern requires an explicit commitment / request construction. */
const PATTERNS: { re: RegExp; label: string }[] = [
  { re: /\b(i|we)\s*(will|'ll|shall)\s+(?!not\b|never\b|be\s+(?:right|back)\b)\w+/i, label: 'commitment' },
  { re: /\b(i|we)\s+(am|are|'m|'re)\s+going\s+to\s+\w+/i, label: 'commitment' },
  { re: /\b(i|we)\s+(need|have|has)\s+to\s+\w+/i, label: 'obligation' },
  { re: /\b(you|he|she|they)\s+(will|'ll|need to|needs to|have to|has to|should)\s+\w+/i, label: 'assignment' },
  { re: /\b(can|could|would)\s+you\s+(please\s+)?\w+/i, label: 'request' },
  { re: /^\s*please\s+\w+/i, label: 'request' },
  { re: /\blet'?s\s+(?!see\b|say\b|go\b)\w+/i, label: 'proposal' },
  { re: /\b(action item|to-?do|follow up|follow-up)\b/i, label: 'explicit' },
  { re: /\bmake sure (to|that)\b/i, label: 'request' },
];

const QUESTION_ONLY = /^\s*(what|why|how|when|where|who|is|are|do|does|did)\b[^.]*\?\s*$/i;

export function suggestActionItems(sources: ActionSource[]): ActionSuggestion[] {
  const out: ActionSuggestion[] = [];
  for (const s of sources) {
    const text = s.text.trim();
    if (text.split(/\s+/).length < 3) continue;
    if (QUESTION_ONLY.test(text) && !/\b(can|could|would)\s+you\b/i.test(text)) continue;
    const hit = PATTERNS.find((p) => p.re.test(text));
    if (!hit) continue;
    let task = text.replace(/^\s*(so|okay|ok|and|also|then|um|uh)[, ]+/i, '').trim();
    task = task.charAt(0).toUpperCase() + task.slice(1);
    out.push({ sourceSegmentId: s.segmentId, taskText: task, trigger: hit.label });
  }
  return out;
}
