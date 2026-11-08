import type { ActionItem } from '@/types';
import { uuid } from '@/utils/id';

import type { SqlDb } from '../types';

interface Row {
  id: string;
  meeting_id: string;
  source_segment_id: string | null;
  task_text: string;
  assignee: string | null;
  due_at: number | null;
  is_suggestion: number;
  is_complete: number;
  updated_at: number;
}

const map = (r: Row): ActionItem => ({
  id: r.id,
  meetingId: r.meeting_id,
  sourceSegmentId: r.source_segment_id,
  taskText: r.task_text,
  assignee: r.assignee,
  dueAt: r.due_at,
  isSuggestion: !!r.is_suggestion,
  isComplete: !!r.is_complete,
  updatedAt: r.updated_at,
});

export async function listActionItems(db: SqlDb, meetingId: string): Promise<ActionItem[]> {
  const rows = await db.all<Row>(
    `SELECT a.* FROM action_items a
       LEFT JOIN transcript_segments s ON s.id = a.source_segment_id
      WHERE a.meeting_id = ?
      ORDER BY a.is_complete ASC, COALESCE(s.start_ms, 9e15) ASC, a.updated_at ASC`,
    [meetingId],
  );
  return rows.map(map);
}

export interface SaveActionItemInput {
  id?: string;
  meetingId: string;
  sourceSegmentId?: string | null;
  taskText: string;
  assignee?: string | null;
  dueAt?: number | null;
  isSuggestion?: boolean;
  isComplete?: boolean;
}

export async function saveActionItem(db: SqlDb, a: SaveActionItemInput, now = Date.now()): Promise<string> {
  const text = a.taskText.trim();
  if (!text) throw new Error('Task text cannot be empty');
  if (a.id) {
    await db.run(
      `UPDATE action_items SET task_text = ?, assignee = ?, due_at = ?, is_suggestion = ?, is_complete = ?, updated_at = ? WHERE id = ?`,
      [text, a.assignee?.trim() || null, a.dueAt ?? null, a.isSuggestion ? 1 : 0, a.isComplete ? 1 : 0, now, a.id],
    );
    return a.id;
  }
  const id = uuid();
  await db.run(
    `INSERT INTO action_items (id, meeting_id, source_segment_id, task_text, assignee, due_at, is_suggestion, is_complete, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, a.meetingId, a.sourceSegmentId ?? null, text, a.assignee?.trim() || null, a.dueAt ?? null, a.isSuggestion ? 1 : 0, a.isComplete ? 1 : 0, now],
  );
  return id;
}

/** Inserts heuristic suggestions, skipping segments that already produced an item (idempotent). */
export async function addSuggestions(
  db: SqlDb,
  meetingId: string,
  suggestions: { sourceSegmentId: string; taskText: string }[],
  now = Date.now(),
): Promise<number> {
  let added = 0;
  await db.transaction(async (tx) => {
    for (const s of suggestions) {
      const exists = await tx.first<{ id: string }>(
        'SELECT id FROM action_items WHERE meeting_id = ? AND source_segment_id = ?',
        [meetingId, s.sourceSegmentId],
      );
      if (exists) continue;
      await tx.run(
        `INSERT INTO action_items (id, meeting_id, source_segment_id, task_text, assignee, due_at, is_suggestion, is_complete, updated_at)
         VALUES (?, ?, ?, ?, NULL, NULL, 1, 0, ?)`,
        [uuid(), meetingId, s.sourceSegmentId, s.taskText, now],
      );
      added++;
    }
  });
  return added;
}

export async function setActionComplete(db: SqlDb, id: string, complete: boolean, now = Date.now()) {
  await db.run('UPDATE action_items SET is_complete = ?, updated_at = ? WHERE id = ?', [complete ? 1 : 0, now, id]);
}

export async function deleteActionItem(db: SqlDb, id: string) {
  await db.run('DELETE FROM action_items WHERE id = ?', [id]);
}
