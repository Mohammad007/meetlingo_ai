import type { SummaryKeyPoint } from '@/types';

/**
 * Basic offline extractive summary.
 *
 * Method (transparent, no generative model):
 *  1. Tokenise English captions, drop stop words, compute term frequency across the meeting.
 *  2. Score each caption by the mean TF of its content words, boosted slightly for decision/commitment
 *     verbs, and penalised when very short.
 *  3. Pick the top N captions (diversity: skip near-duplicates), return them in chronological order with
 *     links back to their source segment.
 * Keywords are the highest-TF content words. Nothing is invented: every key point is a verbatim caption.
 */

export const STOP_WORDS = new Set(
  `a about above after again against all am an and any are aren't as at be because been before being below between
both but by can can't cannot could couldn't did didn't do does doesn't doing don't down during each few for from
further had hadn't has hasn't have haven't having he he'd he'll he's her here here's hers herself him himself his how
how's i i'd i'll i'm i've if in into is isn't it it's its itself let's me more most mustn't my myself no nor not of off
on once only or other ought our ours ourselves out over own same shan't she she'd she'll she's should shouldn't so some
such than that that's the their theirs them themselves then there there's these they they'd they'll they're they've
this those through to too under until up very was wasn't we we'd we'll we're we've were weren't what what's when when's
where where's which while who who's whom why why's with won't would wouldn't you you'd you'll you're you've your yours
yourself yourselves okay ok yeah yes uh um like just really actually going gonna get got also well so right thing things
know think mean one two lot kind sort maybe need want say said see`.split(/\s+/),
);

const BOOST = /\b(decid|agree|will|plan|deadline|release|launch|priority|issue|fix|deliver|complete|finish|review|confirm|test|deploy|ship|budget|risk|next)/i;

export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9][a-z0-9'+.#-]*/g) ?? [])
    .map((t) => t.replace(/[.'-]+$/, ''))
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t) && !/^\d+$/.test(t));
}

export interface SummarySource {
  segmentId: string;
  startMs: number;
  text: string;
}

export interface ExtractiveSummary {
  keyPoints: SummaryKeyPoint[];
  keywords: string[];
  summaryText: string;
  sourceCount: number;
}

function jaccard(a: Set<string>, b: Set<string>) {
  let inter = 0;
  a.forEach((x) => {
    if (b.has(x)) inter++;
  });
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

export function summarize(sources: SummarySource[], opts: { maxPoints?: number; maxKeywords?: number } = {}): ExtractiveSummary {
  const usable = sources.filter((s) => s.text.trim().length > 0);
  const maxPoints = opts.maxPoints ?? Math.min(7, Math.max(3, Math.round(usable.length / 8)));
  const maxKeywords = opts.maxKeywords ?? 10;
  if (!usable.length) return { keyPoints: [], keywords: [], summaryText: '', sourceCount: 0 };

  const tf = new Map<string, number>();
  const tokenized = usable.map((s) => {
    const toks = tokenize(s.text);
    toks.forEach((t) => tf.set(t, (tf.get(t) ?? 0) + 1));
    return toks;
  });

  const scored = usable.map((s, i) => {
    const toks = tokenized[i];
    if (!toks.length) return { s, score: 0, set: new Set<string>() };
    const unique = new Set(toks);
    let sum = 0;
    unique.forEach((t) => (sum += tf.get(t) ?? 0));
    let score = sum / Math.sqrt(unique.size + 1);
    if (BOOST.test(s.text)) score *= 1.25;
    if (toks.length < 4) score *= 0.5;
    return { s, score, set: unique };
  });

  const ranked = [...scored].sort((a, b) => b.score - a.score);
  const picked: typeof scored = [];
  for (const c of ranked) {
    if (picked.length >= maxPoints) break;
    if (c.score <= 0) break;
    if (picked.some((p) => jaccard(p.set, c.set) > 0.6)) continue;
    picked.push(c);
  }
  picked.sort((a, b) => a.s.startMs - b.s.startMs);

  const keywords = [...tf.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, maxKeywords)
    .map(([w]) => w);

  const keyPoints: SummaryKeyPoint[] = picked.map((p) => ({
    text: p.s.text.trim(),
    segmentId: p.s.segmentId,
    startMs: p.s.startMs,
    score: Math.round(p.score * 100) / 100,
  }));
  const summaryText = keyPoints.map((k) => `• ${k.text}`).join('\n');
  return { keyPoints, keywords, summaryText, sourceCount: usable.length };
}
