export type MeetingMode = 'physical' | 'laptop' | 'same_phone';
export type AudioSource = 'microphone' | 'permitted_playback';
export type CaptionState = 'interim' | 'final' | 'translation_pending' | 'translated' | 'failed';
export type MeetingStatus = 'active' | 'paused' | 'completed' | 'interrupted';

/** Caption display output. */
export type OutputMode = 'dual' | 'hinglish' | 'english';
/** Target language style for the translated line. */
export type TranslationStyle = 'natural_hinglish' | 'simple_hinglish' | 'devanagari' | 'english' | 'dual_language';

export interface CaptionEvent {
  meetingId: string;
  segmentId: string;
  sequenceNo: number;
  /** Session-relative milliseconds from meeting start. */
  startMs: number;
  endMs?: number;
  englishText: string;
  hindiText?: string;
  hinglishText?: string;
  state: CaptionState;
  confidence?: number;
  speakerLabel?: string;
}

export interface Meeting {
  id: string;
  title: string;
  mode: MeetingMode;
  source: AudioSource;
  /** Unix epoch ms. */
  startedAt: number;
  endedAt: number | null;
  status: MeetingStatus;
  saveTranscript: boolean;
  saveAudio: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface MeetingListItem extends Meeting {
  segmentCount: number;
  durationMs: number;
}

export interface TranscriptSegment {
  id: string;
  meetingId: string;
  sequenceNo: number;
  startMs: number;
  endMs: number | null;
  englishText: string;
  hindiText: string | null;
  hinglishText: string | null;
  /** User-corrected Hinglish; takes precedence in display/export when present. */
  correctedHinglish: string | null;
  state: CaptionState;
  confidence: number | null;
  speakerLabel: string | null;
  createdAt: number;
  updatedAt: number;
}

export type GlossaryRuleType = 'preserve_english' | 'translate_as' | 'romanization_override';

export interface GlossaryEntry {
  id: string;
  sourcePhrase: string;
  replacement: string;
  ruleType: GlossaryRuleType;
  enabled: boolean;
  updatedAt: number;
}

export interface ActionItem {
  id: string;
  meetingId: string;
  sourceSegmentId: string | null;
  taskText: string;
  assignee: string | null;
  dueAt: number | null;
  isSuggestion: boolean;
  isComplete: boolean;
  updatedAt: number;
}

export interface SummaryKeyPoint {
  text: string;
  segmentId: string;
  startMs: number;
  score: number;
}

export interface MeetingSummary {
  meetingId: string;
  summaryText: string;
  keyPoints: SummaryKeyPoint[];
  keywords: string[];
  method: 'local_extractive' | 'user_edited';
  updatedAt: number;
}

export interface InstalledModelRow {
  modelId: string;
  modelKind: 'asr' | 'translation';
  modelVersion: string;
  localPath: string | null;
  sha256: string | null;
  sizeBytes: number | null;
  verified: boolean;
  installedAt: number | null;
}

export interface SearchHit {
  segmentId: string;
  meetingId: string;
  meetingTitle: string;
  meetingStartedAt: number;
  startMs: number;
  englishText: string;
  hinglishText: string | null;
}
