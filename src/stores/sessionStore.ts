import { create } from 'zustand';

import type { AudioLevelEvent, EngineErrorEvent, NativeSessionState } from '@/../modules/meetlingo-native';
import type { CaptionState, Meeting, MeetingMode, OutputMode, TranslationStyle } from '@/types';

export interface LiveCaption {
  segmentId: string;
  sequenceNo: number;
  startMs: number;
  endMs: number | null;
  englishText: string;
  hindiText: string | null;
  hinglishText: string | null;
  state: CaptionState;
  error?: string | null;
}

export interface InterimCaption {
  segmentId: string;
  startMs: number;
  text: string;
}

export interface SessionIssue {
  code: string;
  message: string;
  fatal: boolean;
  at: number;
}

export interface ActiveMeeting extends Pick<Meeting, 'id' | 'title' | 'mode' | 'source' | 'startedAt' | 'saveTranscript' | 'saveAudio'> {
  outputMode: OutputMode;
  translationStyle: TranslationStyle;
  asrModelId: string;
}

interface SessionStoreState {
  meeting: ActiveMeeting | null;
  nativeState: NativeSessionState;
  deviceName: string;
  captions: LiveCaption[];
  interim: InterimCaption | null;
  level: (AudioLevelEvent & { receivedAt: number }) | null;
  issues: SessionIssue[];
  lastEndedMeetingId: string | null;
  lastEndReason: string | null;
  /** Wall-clock time spent paused (for elapsed display). */
  pausedTotalMs: number;
  pausedAt: number | null;
  setMeeting: (m: ActiveMeeting | null) => void;
  setNativeState: (s: NativeSessionState, deviceName?: string) => void;
  upsertCaption: (c: LiveCaption) => void;
  patchCaption: (segmentId: string, patch: Partial<LiveCaption>) => void;
  setInterim: (i: InterimCaption | null) => void;
  setLevel: (l: AudioLevelEvent | null) => void;
  addIssue: (e: EngineErrorEvent) => void;
  clearIssues: () => void;
  removeIssue: (code: string) => void;
  updateMeetingPrefs: (p: Partial<Pick<ActiveMeeting, 'outputMode' | 'translationStyle'>>) => void;
  endSession: (meetingId: string | null, reason: string | null) => void;
}

const MAX_LIVE_CAPTIONS = 400; // older captions remain in SQLite; the live list is a bounded window

export const useSessionStore = create<SessionStoreState>((set) => ({
  meeting: null,
  nativeState: 'idle',
  deviceName: '',
  captions: [],
  interim: null,
  level: null,
  issues: [],
  lastEndedMeetingId: null,
  lastEndReason: null,
  pausedTotalMs: 0,
  pausedAt: null,
  setMeeting: (meeting) =>
    set({ meeting, captions: [], interim: null, issues: [], pausedTotalMs: 0, pausedAt: null, nativeState: meeting ? 'starting' : 'idle' }),
  setNativeState: (nativeState, deviceName) =>
    set((s) => {
      const now = Date.now();
      let { pausedAt, pausedTotalMs } = s;
      if (nativeState === 'paused' && pausedAt == null) pausedAt = now;
      if (nativeState !== 'paused' && pausedAt != null) {
        pausedTotalMs += now - pausedAt;
        pausedAt = null;
      }
      return { nativeState, deviceName: deviceName ?? s.deviceName, pausedAt, pausedTotalMs };
    }),
  upsertCaption: (c) =>
    set((s) => {
      const idx = s.captions.findIndex((x) => x.segmentId === c.segmentId);
      let captions: LiveCaption[];
      if (idx >= 0) {
        captions = [...s.captions];
        captions[idx] = { ...captions[idx], ...c };
      } else {
        captions = [...s.captions, c].sort((a, b) => a.startMs - b.startMs || a.sequenceNo - b.sequenceNo);
        if (captions.length > MAX_LIVE_CAPTIONS) captions = captions.slice(-MAX_LIVE_CAPTIONS);
      }
      const interim = s.interim?.segmentId === c.segmentId ? null : s.interim;
      return { captions, interim };
    }),
  patchCaption: (segmentId, patch) =>
    set((s) => ({ captions: s.captions.map((c) => (c.segmentId === segmentId ? { ...c, ...patch } : c)) })),
  setInterim: (interim) => set({ interim }),
  setLevel: (level) => set({ level: level ? { ...level, receivedAt: Date.now() } : null }),
  addIssue: (e) =>
    set((s) => ({ issues: [...s.issues.filter((i) => i.code !== e.code).slice(-9), { code: e.code, message: e.message, fatal: e.fatal, at: Date.now() }] })),
  clearIssues: () => set({ issues: [] }),
  removeIssue: (code) => set((s) => ({ issues: s.issues.filter((i) => i.code !== code) })),
  updateMeetingPrefs: (p) => set((s) => (s.meeting ? { meeting: { ...s.meeting, ...p } } : {})),
  endSession: (meetingId, reason) =>
    set({ meeting: null, nativeState: 'idle', interim: null, level: null, lastEndedMeetingId: meetingId, lastEndReason: reason, pausedAt: null }),
}));

export interface MeetingDraft {
  title: string;
  mode: MeetingMode;
  source: 'microphone' | 'permitted_playback';
  outputMode: OutputMode;
  translationStyle: TranslationStyle;
  saveTranscript: boolean;
  saveAudio: boolean;
  keepAwake: boolean;
}

interface DraftState {
  draft: MeetingDraft | null;
  setDraft: (d: MeetingDraft | null) => void;
}

/** The meeting being configured between Mode Selector -> Setup -> Audio Test -> Live. */
export const useDraftStore = create<DraftState>((set) => ({
  draft: null,
  setDraft: (draft) => set({ draft }),
}));
