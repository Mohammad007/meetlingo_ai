import type { MeetingSummary, SummaryKeyPoint } from '@/types';

import type { SqlDb } from '../types';

interface Row {
  meeting_id: string;
  summary_text: string;
  method: MeetingSummary['method'];
  key_points_json: string;
  keywords_json: string;
  updated_at: number;
}

function parse<T>(s: string, fallback: T): T {
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

export async function getSummary(db: SqlDb, meetingId: string): Promise<MeetingSummary | null> {
  const r = await db.first<Row>('SELECT * FROM meeting_summaries WHERE meeting_id = ?', [meetingId]);
  if (!r) return null;
  return {
    meetingId: r.meeting_id,
    summaryText: r.summary_text,
    method: r.method,
    keyPoints: parse<SummaryKeyPoint[]>(r.key_points_json, []),
    keywords: parse<string[]>(r.keywords_json, []),
    updatedAt: r.updated_at,
  };
}

export async function saveSummary(db: SqlDb, s: Omit<MeetingSummary, 'updatedAt'>, now = Date.now()) {
  await db.run(
    `INSERT INTO meeting_summaries (meeting_id, summary_text, method, key_points_json, keywords_json, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(meeting_id) DO UPDATE SET summary_text = excluded.summary_text, method = excluded.method,
       key_points_json = excluded.key_points_json, keywords_json = excluded.keywords_json, updated_at = excluded.updated_at`,
    [s.meetingId, s.summaryText, s.method, JSON.stringify(s.keyPoints), JSON.stringify(s.keywords), now],
  );
}
