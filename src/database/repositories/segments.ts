import type { CaptionState, TranscriptSegment } from '@/types';

import type { SqlDb } from '../types';

interface SegmentRow {
  id: string;
  meeting_id: string;
  sequence_no: number;
  start_ms: number;
  end_ms: number | null;
  english_text: string;
  hindi_text: string | null;
  hinglish_text: string | null;
  corrected_hinglish: string | null;
  state: CaptionState;
  confidence: number | null;
  speaker_label: string | null;
  created_at: number;
  updated_at: number;
}

export function mapSegment(r: SegmentRow): TranscriptSegment {
  return {
    id: r.id,
    meetingId: r.meeting_id,
    sequenceNo: r.sequence_no,
    startMs: r.start_ms,
    endMs: r.end_ms,
    englishText: r.english_text,
    hindiText: r.hindi_text,
    hinglishText: r.hinglish_text,
    correctedHinglish: r.corrected_hinglish,
    state: r.state,
    confidence: r.confidence,
    speakerLabel: r.speaker_label,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export interface UpsertSegmentInput {
  id: string;
  meetingId: string;
  sequenceNo: number;
  startMs: number;
  endMs?: number | null;
  englishText: string;
  state: CaptionState;
  confidence?: number | null;
}

/**
 * Inserts a finalised segment or updates it if the same segment id was already stored.
 * The UNIQUE(meeting_id, sequence_no) constraint guarantees a finalised segment is never duplicated when
 * the recogniser re-emits a boundary; a conflicting sequence number is shifted to the next free slot.
 * Runs inside a transaction (final caption commit).
 */
export async function upsertSegment(db: SqlDb, s: UpsertSegmentInput, now = Date.now()): Promise<TranscriptSegment> {
  return db.transaction(async (tx) => {
    const existing = await tx.first<SegmentRow>('SELECT * FROM transcript_segments WHERE id = ?', [s.id]);
    if (existing) {
      await tx.run(
        `UPDATE transcript_segments SET english_text = ?, end_ms = ?, state = ?, confidence = ?, updated_at = ? WHERE id = ?`,
        [s.englishText, s.endMs ?? existing.end_ms, s.state, s.confidence ?? existing.confidence, now, s.id],
      );
    } else {
      let seq = s.sequenceNo;
      const clash = await tx.first<{ id: string }>(
        'SELECT id FROM transcript_segments WHERE meeting_id = ? AND sequence_no = ?',
        [s.meetingId, seq],
      );
      if (clash) {
        const max = await tx.first<{ m: number | null }>(
          'SELECT MAX(sequence_no) AS m FROM transcript_segments WHERE meeting_id = ?',
          [s.meetingId],
        );
        seq = (max?.m ?? -1) + 1;
      }
      await tx.run(
        `INSERT INTO transcript_segments
          (id, meeting_id, sequence_no, start_ms, end_ms, english_text, state, confidence, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [s.id, s.meetingId, seq, s.startMs, s.endMs ?? null, s.englishText, s.state, s.confidence ?? null, now, now],
      );
      await tx.run('UPDATE meetings SET updated_at = ? WHERE id = ?', [now, s.meetingId]);
    }
    const row = await tx.first<SegmentRow>('SELECT * FROM transcript_segments WHERE id = ?', [s.id]);
    return mapSegment(row!);
  });
}

export interface TranslationUpdate {
  hindiText: string | null;
  hinglishText: string | null;
  state: Extract<CaptionState, 'translated' | 'failed' | 'translation_pending'>;
  error?: string | null;
}

export async function updateTranslation(db: SqlDb, segmentId: string, u: TranslationUpdate, now = Date.now()) {
  await db.transaction(async (tx) => {
    await tx.run(
      `UPDATE transcript_segments SET hindi_text = ?, hinglish_text = ?, state = ?, translation_error = ?, updated_at = ? WHERE id = ?`,
      [u.hindiText, u.hinglishText, u.state, u.error ?? null, now, segmentId],
    );
  });
}

export async function saveCorrection(db: SqlDb, segmentId: string, correctedHinglish: string | null, now = Date.now()) {
  const v = correctedHinglish?.trim() ? correctedHinglish.trim() : null;
  await db.run('UPDATE transcript_segments SET corrected_hinglish = ?, updated_at = ? WHERE id = ?', [v, now, segmentId]);
}

export async function listSegments(db: SqlDb, meetingId: string): Promise<TranscriptSegment[]> {
  const rows = await db.all<SegmentRow>(
    'SELECT * FROM transcript_segments WHERE meeting_id = ? ORDER BY start_ms ASC, sequence_no ASC',
    [meetingId],
  );
  return rows.map(mapSegment);
}

export async function getSegment(db: SqlDb, id: string): Promise<TranscriptSegment | null> {
  const r = await db.first<SegmentRow>('SELECT * FROM transcript_segments WHERE id = ?', [id]);
  return r ? mapSegment(r) : null;
}

export async function nextSequenceNo(db: SqlDb, meetingId: string): Promise<number> {
  const r = await db.first<{ m: number | null }>(
    'SELECT MAX(sequence_no) AS m FROM transcript_segments WHERE meeting_id = ?',
    [meetingId],
  );
  return (r?.m ?? -1) + 1;
}

/** Segments whose translation never completed (app killed, translator missing) — retryable. */
export async function listUntranslated(db: SqlDb, meetingId?: string): Promise<TranscriptSegment[]> {
  const rows = await db.all<SegmentRow>(
    `SELECT * FROM transcript_segments WHERE state IN ('final','translation_pending','failed')
      ${meetingId ? 'AND meeting_id = ?' : ''} ORDER BY start_ms ASC`,
    meetingId ? [meetingId] : [],
  );
  return rows.map(mapSegment);
}

/** Display text for the translated line, honouring user corrections. */
export function displayHinglish(s: Pick<TranscriptSegment, 'correctedHinglish' | 'hinglishText'>): string | null {
  return s.correctedHinglish ?? s.hinglishText;
}
