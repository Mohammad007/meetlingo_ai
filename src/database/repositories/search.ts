import type { SearchHit } from '@/types';

import type { SqlDb } from '../types';
import { escapeLike } from './meetings';

export interface SearchOptions {
  meetingId?: string;
  fromMs?: number;
  toMs?: number;
  limit?: number;
  /** Force the LIKE fallback (used when FTS5 is unavailable). */
  useFts?: boolean;
}

interface Row {
  segment_id: string;
  meeting_id: string;
  meeting_title: string;
  meeting_started_at: number;
  start_ms: number;
  english_text: string;
  hinglish_text: string | null;
}

/** Builds a safe FTS5 query: each token quoted, prefix-matched, AND-ed. */
export function buildFtsQuery(input: string): string | null {
  const tokens = input
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length > 0)
    .slice(0, 8);
  if (!tokens.length) return null;
  return tokens.map((t) => `"${t.replace(/"/g, '""')}"*`).join(' AND ');
}

/** Searches English, machine Hinglish and corrected Hinglish across meetings. */
export async function searchTranscript(db: SqlDb, query: string, opts: SearchOptions = {}): Promise<SearchHit[]> {
  const q = query.trim();
  if (!q) return [];
  const filters: string[] = [];
  const filterParams: (string | number)[] = [];
  if (opts.meetingId) {
    filters.push('s.meeting_id = ?');
    filterParams.push(opts.meetingId);
  }
  if (opts.fromMs != null) {
    filters.push('m.started_at >= ?');
    filterParams.push(opts.fromMs);
  }
  if (opts.toMs != null) {
    filters.push('m.started_at < ?');
    filterParams.push(opts.toMs);
  }
  const limit = opts.limit ?? 200;
  const select = `SELECT s.id AS segment_id, s.meeting_id, m.title AS meeting_title, m.started_at AS meeting_started_at,
                         s.start_ms, s.english_text, COALESCE(s.corrected_hinglish, s.hinglish_text) AS hinglish_text`;

  const fts = opts.useFts ?? true;
  const ftsQuery = buildFtsQuery(q);
  if (fts && ftsQuery) {
    try {
      const rows = await db.all<Row>(
        `${select}
           FROM segments_fts f
           JOIN transcript_segments s ON s.rowid = f.rowid
           JOIN meetings m ON m.id = s.meeting_id
          WHERE segments_fts MATCH ? ${filters.length ? 'AND ' + filters.join(' AND ') : ''}
          ORDER BY m.started_at DESC, s.start_ms ASC
          LIMIT ?`,
        [ftsQuery, ...filterParams, limit],
      );
      return rows.map(mapHit);
    } catch {
      // FTS table missing or query rejected: fall through to LIKE.
    }
  }
  const like = `%${escapeLike(q)}%`;
  const rows = await db.all<Row>(
    `${select}
       FROM transcript_segments s
       JOIN meetings m ON m.id = s.meeting_id
      WHERE (s.english_text LIKE ? ESCAPE '\\' OR s.hinglish_text LIKE ? ESCAPE '\\' OR s.corrected_hinglish LIKE ? ESCAPE '\\')
        ${filters.length ? 'AND ' + filters.join(' AND ') : ''}
      ORDER BY m.started_at DESC, s.start_ms ASC
      LIMIT ?`,
    [like, like, like, ...filterParams, limit],
  );
  return rows.map(mapHit);
}

const mapHit = (r: Row): SearchHit => ({
  segmentId: r.segment_id,
  meetingId: r.meeting_id,
  meetingTitle: r.meeting_title,
  meetingStartedAt: r.meeting_started_at,
  startMs: r.start_ms,
  englishText: r.english_text,
  hinglishText: r.hinglish_text,
});

/** Splits text into highlight runs for a case-insensitive query (used by search result rendering). */
export function highlightRuns(text: string, query: string): { text: string; match: boolean }[] {
  const terms = query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!terms.length || !text) return [{ text, match: false }];
  const re = new RegExp(`(${terms.join('|')})`, 'gi');
  const out: { text: string; match: boolean }[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ text: text.slice(last, i), match: false });
    out.push({ text: m[0], match: true });
    last = i + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), match: false });
  return out;
}
