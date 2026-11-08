/**
 * Versioned SQL migrations. The applied version is tracked in `PRAGMA user_version`.
 * Never edit a released migration: append a new one.
 */
export interface Migration {
  version: number;
  name: string;
  statements: string[];
  /** When true, a failure does not abort startup; the feature is recorded as unavailable. */
  optional?: boolean;
}

export const migrations: Migration[] = [
  {
    version: 1,
    name: 'initial_schema',
    statements: [
      `CREATE TABLE IF NOT EXISTS meetings (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        mode TEXT NOT NULL CHECK (mode IN ('physical','laptop','same_phone')),
        source TEXT NOT NULL DEFAULT 'microphone',
        started_at INTEGER NOT NULL,
        ended_at INTEGER,
        status TEXT NOT NULL DEFAULT 'active',
        save_transcript INTEGER NOT NULL DEFAULT 1,
        save_audio INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS transcript_segments (
        id TEXT PRIMARY KEY,
        meeting_id TEXT NOT NULL,
        sequence_no INTEGER NOT NULL,
        start_ms INTEGER NOT NULL,
        end_ms INTEGER,
        english_text TEXT NOT NULL DEFAULT '',
        hindi_text TEXT,
        hinglish_text TEXT,
        state TEXT NOT NULL DEFAULT 'final',
        confidence REAL,
        speaker_label TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY(meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
        UNIQUE(meeting_id, sequence_no)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_segments_meeting_time ON transcript_segments(meeting_id, start_ms)`,
      `CREATE TABLE IF NOT EXISTS glossary_entries (
        id TEXT PRIMARY KEY,
        source_phrase TEXT NOT NULL,
        replacement TEXT NOT NULL,
        rule_type TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        updated_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        json_value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS installed_models (
        model_id TEXT PRIMARY KEY,
        model_kind TEXT NOT NULL,
        model_version TEXT NOT NULL,
        local_path TEXT,
        sha256 TEXT,
        size_bytes INTEGER,
        verified INTEGER NOT NULL DEFAULT 0,
        installed_at INTEGER
      )`,
      `CREATE TABLE IF NOT EXISTS action_items (
        id TEXT PRIMARY KEY,
        meeting_id TEXT NOT NULL,
        source_segment_id TEXT,
        task_text TEXT NOT NULL,
        due_at INTEGER,
        is_suggestion INTEGER NOT NULL DEFAULT 1,
        is_complete INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY(meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
        FOREIGN KEY(source_segment_id) REFERENCES transcript_segments(id) ON DELETE SET NULL
      )`,
      `CREATE TABLE IF NOT EXISTS meeting_summaries (
        meeting_id TEXT PRIMARY KEY,
        summary_text TEXT NOT NULL,
        method TEXT NOT NULL DEFAULT 'local_extractive',
        updated_at INTEGER NOT NULL,
        FOREIGN KEY(meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
      )`,
    ],
  },
  {
    version: 2,
    name: 'corrections_assignees_summary_details',
    statements: [
      `ALTER TABLE transcript_segments ADD COLUMN corrected_hinglish TEXT`,
      `ALTER TABLE transcript_segments ADD COLUMN translation_error TEXT`,
      `ALTER TABLE action_items ADD COLUMN assignee TEXT`,
      `ALTER TABLE meeting_summaries ADD COLUMN key_points_json TEXT NOT NULL DEFAULT '[]'`,
      `ALTER TABLE meeting_summaries ADD COLUMN keywords_json TEXT NOT NULL DEFAULT '[]'`,
      `CREATE INDEX IF NOT EXISTS idx_meetings_started ON meetings(started_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_segments_state ON transcript_segments(state)`,
      `CREATE INDEX IF NOT EXISTS idx_actions_meeting ON action_items(meeting_id)`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_glossary_phrase_type ON glossary_entries(lower(source_phrase), rule_type)`,
    ],
  },
  {
    version: 3,
    name: 'fts5_transcript_search',
    optional: true,
    statements: [
      `CREATE VIRTUAL TABLE IF NOT EXISTS segments_fts USING fts5(
        english_text, hinglish_text, corrected_hinglish,
        content='transcript_segments', content_rowid='rowid',
        tokenize='unicode61 remove_diacritics 2'
      )`,
      `CREATE TRIGGER IF NOT EXISTS segments_fts_ai AFTER INSERT ON transcript_segments BEGIN
        INSERT INTO segments_fts(rowid, english_text, hinglish_text, corrected_hinglish)
        VALUES (new.rowid, new.english_text, new.hinglish_text, new.corrected_hinglish);
      END`,
      `CREATE TRIGGER IF NOT EXISTS segments_fts_ad AFTER DELETE ON transcript_segments BEGIN
        INSERT INTO segments_fts(segments_fts, rowid, english_text, hinglish_text, corrected_hinglish)
        VALUES ('delete', old.rowid, old.english_text, old.hinglish_text, old.corrected_hinglish);
      END`,
      `CREATE TRIGGER IF NOT EXISTS segments_fts_au AFTER UPDATE ON transcript_segments BEGIN
        INSERT INTO segments_fts(segments_fts, rowid, english_text, hinglish_text, corrected_hinglish)
        VALUES ('delete', old.rowid, old.english_text, old.hinglish_text, old.corrected_hinglish);
        INSERT INTO segments_fts(rowid, english_text, hinglish_text, corrected_hinglish)
        VALUES (new.rowid, new.english_text, new.hinglish_text, new.corrected_hinglish);
      END`,
      `INSERT INTO segments_fts(segments_fts) VALUES ('rebuild')`,
    ],
  },
];

export const LATEST_SCHEMA_VERSION = migrations[migrations.length - 1].version;
