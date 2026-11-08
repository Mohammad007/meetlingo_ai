/**
 * @jest-environment node
 */
import {
  addSuggestions,
  applyRetention,
  clearAllData,
  createMeeting,
  deleteGlossaryEntry,
  deleteMeeting,
  endMeeting,
  getMeeting,
  getSetting,
  getSummary,
  listActionItems,
  listGlossary,
  listMeetings,
  listSegments,
  listUntranslated,
  nextSequenceNo,
  recoverInterruptedMeetings,
  renameMeeting,
  runMigrations,
  saveActionItem,
  saveCorrection,
  saveGlossaryEntry,
  saveSummary,
  searchTranscript,
  seedDefaultGlossary,
  setActionComplete,
  setSetting,
  sqliteSelfTest,
  updateTranslation,
  upsertSegment,
  type SqlDb,
} from '@/database';
import { LATEST_SCHEMA_VERSION, migrations } from '@/database/migrations';

import { createNodeDb } from './helpers/nodeDb';

let db: SqlDb;

beforeEach(async () => {
  db = createNodeDb();
  await runMigrations(db);
});

afterEach(async () => {
  await db.close();
});

async function seedMeeting(title = 'Weekly Standup', startedAt = 1_700_000_000_000) {
  return createMeeting(db, { title, mode: 'physical', source: 'microphone', saveTranscript: true, saveAudio: false, now: startedAt });
}

describe('migrations', () => {
  it('applies all migrations and records PRAGMA user_version', async () => {
    const v = await db.first<{ user_version: number }>('PRAGMA user_version');
    expect(v?.user_version).toBe(LATEST_SCHEMA_VERSION);
    const tables = (await db.all<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table'")).map((t) => t.name);
    for (const t of ['meetings', 'transcript_segments', 'glossary_entries', 'app_settings', 'installed_models', 'action_items', 'meeting_summaries', 'segments_fts']) {
      expect(tables).toContain(t);
    }
  });

  it('is idempotent when run again', async () => {
    const r = await runMigrations(db);
    expect(r.applied).toEqual([]);
    expect(r.ftsAvailable).toBe(true);
  });

  it('upgrades an existing v1 database without losing data', async () => {
    const old = createNodeDb();
    await runMigrations(old, migrations.slice(0, 1));
    await old.run(
      "INSERT INTO meetings (id,title,mode,source,started_at,status,save_transcript,save_audio,created_at,updated_at) VALUES ('m1','Old','physical','microphone',1,'completed',1,0,1,1)",
    );
    await old.run(
      "INSERT INTO transcript_segments (id,meeting_id,sequence_no,start_ms,english_text,state,created_at,updated_at) VALUES ('s1','m1',0,0,'hello build','final',1,1)",
    );
    const r = await runMigrations(old);
    expect(r.fromVersion).toBe(1);
    expect(r.toVersion).toBe(LATEST_SCHEMA_VERSION);
    expect((await searchTranscript(old, 'build')).map((h) => h.segmentId)).toEqual(['s1']);
    await old.close();
  });

  it('skips optional FTS migration gracefully when it fails', async () => {
    const d = createNodeDb();
    const broken = migrations.map((m) => (m.optional ? { ...m, statements: ['CREATE VIRTUAL TABLE x USING not_a_module(a)'] } : m));
    const r = await runMigrations(d, broken);
    expect(r.ftsAvailable).toBe(false);
    expect(r.skippedOptional).toHaveLength(1);
    expect(r.toVersion).toBe(LATEST_SCHEMA_VERSION);
    await d.close();
  });
});

describe('meetings & segments', () => {
  it('creates, renames, ends and lists meetings with counts', async () => {
    const m = await seedMeeting();
    await upsertSegment(db, { id: 'a', meetingId: m.id, sequenceNo: 0, startMs: 0, endMs: 1500, englishText: 'Please share the latest build.', state: 'final' }, m.startedAt + 2000);
    await renameMeeting(db, m.id, '  Sprint sync ');
    await endMeeting(db, m.id, 'completed', m.startedAt + 60_000);
    const list = await listMeetings(db);
    expect(list).toHaveLength(1);
    expect(list[0].title).toBe('Sprint sync');
    expect(list[0].segmentCount).toBe(1);
    expect(list[0].durationMs).toBe(60_000);
    expect(list[0].status).toBe('completed');
    await expect(renameMeeting(db, m.id, '   ')).rejects.toThrow();
  });

  it('never duplicates a finalised segment and shifts clashing sequence numbers', async () => {
    const m = await seedMeeting();
    await upsertSegment(db, { id: 'seg-1', meetingId: m.id, sequenceNo: 0, startMs: 0, englishText: 'first', state: 'final' });
    await upsertSegment(db, { id: 'seg-1', meetingId: m.id, sequenceNo: 0, startMs: 0, endMs: 900, englishText: 'first (updated)', state: 'final' });
    const s2 = await upsertSegment(db, { id: 'seg-2', meetingId: m.id, sequenceNo: 0, startMs: 1000, englishText: 'second', state: 'final' });
    const segs = await listSegments(db, m.id);
    expect(segs.map((s) => s.id)).toEqual(['seg-1', 'seg-2']);
    expect(segs[0].englishText).toBe('first (updated)');
    expect(s2.sequenceNo).toBe(1);
    expect(await nextSequenceNo(db, m.id)).toBe(2);
  });

  it('stores translations, failures and user corrections', async () => {
    const m = await seedMeeting();
    await upsertSegment(db, { id: 's', meetingId: m.id, sequenceNo: 0, startMs: 0, englishText: 'hello', state: 'translation_pending' });
    expect(await listUntranslated(db, m.id)).toHaveLength(1);
    await updateTranslation(db, 's', { hindiText: 'नमस्ते', hinglishText: 'Namaste', state: 'translated' });
    expect(await listUntranslated(db, m.id)).toHaveLength(0);
    await saveCorrection(db, 's', 'Hello ji');
    let [seg] = await listSegments(db, m.id);
    expect(seg.hinglishText).toBe('Namaste');
    expect(seg.correctedHinglish).toBe('Hello ji');
    await saveCorrection(db, 's', '   ');
    [seg] = await listSegments(db, m.id);
    expect(seg.correctedHinglish).toBeNull();
    await updateTranslation(db, 's', { hindiText: null, hinglishText: null, state: 'failed', error: 'timeout' });
    expect(await listUntranslated(db, m.id)).toHaveLength(1);
  });

  it('cascades deletes to segments, action items and summaries', async () => {
    const m = await seedMeeting();
    await upsertSegment(db, { id: 's', meetingId: m.id, sequenceNo: 0, startMs: 0, englishText: 'I will send the report', state: 'final' });
    await saveActionItem(db, { meetingId: m.id, sourceSegmentId: 's', taskText: 'Send report' });
    await saveSummary(db, { meetingId: m.id, summaryText: 'x', keyPoints: [], keywords: [], method: 'local_extractive' });
    await deleteMeeting(db, m.id);
    expect(await db.first<{ n: number }>('SELECT COUNT(*) AS n FROM transcript_segments')).toEqual({ n: 0 });
    expect(await db.first<{ n: number }>('SELECT COUNT(*) AS n FROM action_items')).toEqual({ n: 0 });
    expect(await getSummary(db, m.id)).toBeNull();
  });

  it('recovers crashed active meetings as interrupted without inventing duration', async () => {
    const m = await seedMeeting('Crashed', 1_000_000);
    await upsertSegment(db, { id: 's', meetingId: m.id, sequenceNo: 0, startMs: 4000, endMs: 9000, englishText: 'x', state: 'final' }, 1_010_000);
    const recovered = await recoverInterruptedMeetings(db, 5_000_000);
    expect(recovered.map((r) => r.id)).toEqual([m.id]);
    const after = await getMeeting(db, m.id);
    expect(after?.status).toBe('interrupted');
    expect(after?.endedAt).toBe(1_000_000 + 9000);
  });

  it('applies retention only to finished meetings older than the cutoff', async () => {
    const day = 86_400_000;
    const now = 100 * day;
    const old = await seedMeeting('Old', now - 40 * day);
    await endMeeting(db, old.id, 'completed', now - 40 * day + 1000);
    const recent = await seedMeeting('Recent', now - 5 * day);
    await endMeeting(db, recent.id, 'completed', now - 5 * day + 1000);
    const removed = await applyRetention(db, 30, now);
    expect(removed).toEqual([old.id]);
    expect(await getMeeting(db, recent.id)).not.toBeNull();
  });
});

describe('search', () => {
  it('finds English and Hinglish text with FTS and the LIKE fallback', async () => {
    const m = await seedMeeting();
    await upsertSegment(db, { id: 'a', meetingId: m.id, sequenceNo: 0, startMs: 0, englishText: 'Please confirm the API response', state: 'final' });
    await updateTranslation(db, 'a', { hindiText: 'x', hinglishText: 'API response confirm karo', state: 'translated' });
    await upsertSegment(db, { id: 'b', meetingId: m.id, sequenceNo: 1, startMs: 5000, englishText: 'Update the dashboard', state: 'final' });
    await saveCorrection(db, 'b', 'Dashboard update kar do');

    for (const useFts of [true, false]) {
      expect((await searchTranscript(db, 'api', { useFts })).map((h) => h.segmentId)).toEqual(['a']);
      expect((await searchTranscript(db, 'karo', { useFts })).map((h) => h.segmentId)).toEqual(['a']);
      expect((await searchTranscript(db, 'kar do', { useFts })).map((h) => h.segmentId)).toEqual(['b']);
      expect(await searchTranscript(db, 'nonexistentword', { useFts })).toEqual([]);
    }
    // prefix search via FTS
    expect((await searchTranscript(db, 'dash')).map((h) => h.segmentId)).toEqual(['b']);
    // special characters never break the query
    expect(await searchTranscript(db, '"AND OR*(')).toEqual([]);
    expect(await searchTranscript(db, '100%_')).toEqual([]);
  });

  it('keeps the FTS index in sync after edits and deletes', async () => {
    const m = await seedMeeting();
    await upsertSegment(db, { id: 'a', meetingId: m.id, sequenceNo: 0, startMs: 0, englishText: 'alpha release', state: 'final' });
    await upsertSegment(db, { id: 'a', meetingId: m.id, sequenceNo: 0, startMs: 0, englishText: 'beta release', state: 'final' });
    expect(await searchTranscript(db, 'alpha')).toEqual([]);
    expect((await searchTranscript(db, 'beta')).length).toBe(1);
    await deleteMeeting(db, m.id);
    expect(await searchTranscript(db, 'beta')).toEqual([]);
  });
});

describe('glossary, settings, actions, summaries', () => {
  it('seeds sample glossary once and enforces validation and uniqueness', async () => {
    expect(await seedDefaultGlossary(db)).toBe(true);
    expect(await seedDefaultGlossary(db)).toBe(false);
    const all = await listGlossary(db);
    expect(all.map((g) => g.sourcePhrase)).toEqual(expect.arrayContaining(['API', 'SDK', 'React Native', 'APK', 'dashboard', 'deployment', 'retest']));
    await expect(saveGlossaryEntry(db, { sourcePhrase: 'api', replacement: 'api', ruleType: 'preserve_english' })).rejects.toThrow(/already exists/);
    await expect(saveGlossaryEntry(db, { sourcePhrase: '', replacement: 'x', ruleType: 'translate_as' })).rejects.toThrow();
    const id = await saveGlossaryEntry(db, { sourcePhrase: 'standup', replacement: 'daily standup', ruleType: 'translate_as' });
    await deleteGlossaryEntry(db, id);
    expect((await listGlossary(db)).length).toBe(all.length);
  });

  it('round-trips JSON settings', async () => {
    await setSetting(db, 'prefs', { theme: 'dark', n: 3 });
    expect(await getSetting(db, 'prefs')).toEqual({ theme: 'dark', n: 3 });
    await setSetting(db, 'prefs', { theme: 'light' });
    expect(await getSetting(db, 'prefs')).toEqual({ theme: 'light' });
  });

  it('manages action items and idempotent suggestions', async () => {
    const m = await seedMeeting();
    await upsertSegment(db, { id: 's1', meetingId: m.id, sequenceNo: 0, startMs: 0, englishText: 'I will send the report', state: 'final' });
    expect(await addSuggestions(db, m.id, [{ sourceSegmentId: 's1', taskText: 'I will send the report' }])).toBe(1);
    expect(await addSuggestions(db, m.id, [{ sourceSegmentId: 's1', taskText: 'I will send the report' }])).toBe(0);
    const [item] = await listActionItems(db, m.id);
    expect(item.isSuggestion).toBe(true);
    expect(item.assignee).toBeNull();
    expect(item.dueAt).toBeNull();
    await setActionComplete(db, item.id, true);
    await saveActionItem(db, { ...item, taskText: 'Send report to client', assignee: 'Riya', isSuggestion: false, isComplete: true });
    const [updated] = await listActionItems(db, m.id);
    expect(updated).toMatchObject({ taskText: 'Send report to client', assignee: 'Riya', isSuggestion: false, isComplete: true });
  });

  it('clears all data but can keep onboarding state', async () => {
    const m = await seedMeeting();
    await upsertSegment(db, { id: 's', meetingId: m.id, sequenceNo: 0, startMs: 0, englishText: 'x', state: 'final' });
    await seedDefaultGlossary(db);
    await setSetting(db, 'onboarding_complete', true);
    await clearAllData(db, { keepOnboarding: true });
    expect(await listMeetings(db)).toEqual([]);
    expect(await listGlossary(db)).toEqual([]);
    expect(await getSetting(db, 'onboarding_complete')).toBe(true);
    expect(await searchTranscript(db, 'x')).toEqual([]);
  });

  it('passes the SQLite self test used by Diagnostics', async () => {
    const r = await sqliteSelfTest(db);
    expect(r.ok).toBe(true);
  });
});
