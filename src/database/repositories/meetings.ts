import type { AudioSource, Meeting, MeetingListItem, MeetingMode, MeetingStatus } from '@/types';
import { uuid } from '@/utils/id';

import type { SqlDb } from '../types';

interface MeetingRow {
  id: string;
  title: string;
  mode: MeetingMode;
  source: AudioSource;
  started_at: number;
  ended_at: number | null;
  status: MeetingStatus;
  save_transcript: number;
  save_audio: number;
  created_at: number;
  updated_at: number;
  segment_count?: number;
  last_end_ms?: number | null;
}

export function mapMeeting(r: MeetingRow): Meeting {
  return {
    id: r.id,
    title: r.title,
    mode: r.mode,
    source: r.source,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    status: r.status,
    saveTranscript: !!r.save_transcript,
    saveAudio: !!r.save_audio,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export interface CreateMeetingInput {
  title: string;
  mode: MeetingMode;
  source: AudioSource;
  saveTranscript: boolean;
  saveAudio: boolean;
  now?: number;
}

export async function createMeeting(db: SqlDb, input: CreateMeetingInput): Promise<Meeting> {
  const now = input.now ?? Date.now();
  const id = uuid();
  const title = input.title.trim() || 'Untitled meeting';
  await db.run(
    `INSERT INTO meetings (id, title, mode, source, started_at, ended_at, status, save_transcript, save_audio, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, NULL, 'active', ?, ?, ?, ?)`,
    [id, title, input.mode, input.source, now, input.saveTranscript ? 1 : 0, input.saveAudio ? 1 : 0, now, now],
  );
  return (await getMeeting(db, id))!;
}

export async function getMeeting(db: SqlDb, id: string): Promise<Meeting | null> {
  const r = await db.first<MeetingRow>('SELECT * FROM meetings WHERE id = ?', [id]);
  return r ? mapMeeting(r) : null;
}

export async function setMeetingStatus(db: SqlDb, id: string, status: MeetingStatus, now = Date.now()) {
  await db.run('UPDATE meetings SET status = ?, updated_at = ? WHERE id = ?', [status, now, id]);
}

export async function endMeeting(db: SqlDb, id: string, status: 'completed' | 'interrupted' = 'completed', now = Date.now()) {
  await db.run(
    'UPDATE meetings SET status = ?, ended_at = COALESCE(ended_at, ?), updated_at = ? WHERE id = ?',
    [status, now, now, id],
  );
}

export async function renameMeeting(db: SqlDb, id: string, title: string, now = Date.now()) {
  const t = title.trim();
  if (!t) throw new Error('Title cannot be empty');
  await db.run('UPDATE meetings SET title = ?, updated_at = ? WHERE id = ?', [t, now, id]);
}

export async function deleteMeeting(db: SqlDb, id: string) {
  await db.run('DELETE FROM meetings WHERE id = ?', [id]);
}

export type MeetingSort = 'newest' | 'oldest' | 'longest' | 'title';

export interface ListMeetingsOptions {
  query?: string;
  mode?: MeetingMode | 'all';
  sort?: MeetingSort;
  limit?: number;
  fromMs?: number;
  toMs?: number;
}

export async function listMeetings(db: SqlDb, opts: ListMeetingsOptions = {}): Promise<MeetingListItem[]> {
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (opts.query?.trim()) {
    where.push('m.title LIKE ? ESCAPE \'\\\'');
    params.push(`%${escapeLike(opts.query.trim())}%`);
  }
  if (opts.mode && opts.mode !== 'all') {
    where.push('m.mode = ?');
    params.push(opts.mode);
  }
  if (opts.fromMs != null) {
    where.push('m.started_at >= ?');
    params.push(opts.fromMs);
  }
  if (opts.toMs != null) {
    where.push('m.started_at < ?');
    params.push(opts.toMs);
  }
  const order = {
    newest: 'm.started_at DESC',
    oldest: 'm.started_at ASC',
    longest: 'duration_ms DESC',
    title: 'm.title COLLATE NOCASE ASC',
  }[opts.sort ?? 'newest'];
  const rows = await db.all<MeetingRow & { segment_count: number; duration_ms: number }>(
    `SELECT m.*,
            (SELECT COUNT(*) FROM transcript_segments s WHERE s.meeting_id = m.id) AS segment_count,
            COALESCE(m.ended_at, m.updated_at) - m.started_at AS duration_ms
       FROM meetings m
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY ${order}
      LIMIT ?`,
    [...params, opts.limit ?? 500],
  );
  return rows.map((r) => ({ ...mapMeeting(r), segmentCount: r.segment_count, durationMs: Math.max(0, r.duration_ms) }));
}

/**
 * Crash recovery: any meeting left 'active'/'paused' when the app starts was interrupted (process death).
 * Captions committed before the crash are kept; we do not pretend capture continued.
 */
export async function recoverInterruptedMeetings(db: SqlDb, now = Date.now()): Promise<Meeting[]> {
  const rows = await db.all<MeetingRow>("SELECT * FROM meetings WHERE status IN ('active','paused')");
  for (const r of rows) {
    const last = await db.first<{ end: number | null }>(
      'SELECT MAX(COALESCE(end_ms, start_ms)) AS end FROM transcript_segments WHERE meeting_id = ?',
      [r.id],
    );
    const endedAt = last?.end != null ? r.started_at + last.end : r.updated_at;
    await db.run("UPDATE meetings SET status = 'interrupted', ended_at = ?, updated_at = ? WHERE id = ?", [
      Math.min(endedAt, now),
      now,
      r.id,
    ]);
  }
  return rows.map((r) => ({ ...mapMeeting(r), status: 'interrupted' as const }));
}

export function escapeLike(s: string) {
  return s.replace(/[\\%_]/g, (c) => '\\' + c);
}
