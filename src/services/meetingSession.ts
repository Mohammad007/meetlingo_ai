import { deactivateKeepAwake, activateKeepAwakeAsync } from 'expo-keep-awake';

import {
  addNativeListener,
  isNativeAvailable,
  MeetLingoNative,
  type NativeCaptionEvent,
} from '@/../modules/meetlingo-native';
import { getDb } from '@/database/db';
import { createMeeting, endMeeting, getMeeting, setMeetingStatus } from '@/database/repositories/meetings';
import { getSegment, listUntranslated, updateTranslation, upsertSegment } from '@/database/repositories/segments';
import { translateToHinglish } from '@/features/captions/hinglish/pipeline';
import { TranslationQueue, type TranslationJob } from '@/features/captions/translationQueue';
import { getActiveGlossary } from '@/features/glossary/glossaryCache';
import { recordMetric } from '@/services/telemetry';
import { resolveUsableAsrModel, useModelStore } from '@/stores/modelStore';
import { useSessionStore, type MeetingDraft } from '@/stores/sessionStore';
import { getAudioOptions, getSettings } from '@/stores/settingsStore';
import { isJunkCaption } from '@/features/captions/junkFilter';
import type { TranslationStyle } from '@/types';

const KEEP_AWAKE_TAG = 'meetlingo-live';

/**
 * JS side of a live meeting. Native events flow:
 *   onCaption(interim) -> session store (ephemeral, replaced in place)
 *   onCaption(final)   -> SQLite transaction (state 'translation_pending') -> translation queue
 *   queue job          -> ML Kit EN->HI -> Hinglish rules -> SQLite (translated|failed) -> store -> overlay
 * Local SQLite is the source of truth; the live list is a bounded window over it.
 */

let subs: { remove: () => void }[] = [];
let finalsSeen = new Set<string>();

const queue = new TranslationQueue({
  maxBacklog: 30,
  run: runTranslationJob,
  onDrop: (job) => {
    recordMetric('translation_dropped');
    useSessionStore.getState().patchCaption(job.segmentId, { state: 'translation_pending', error: 'Queue overloaded — tap retry' });
    useSessionStore.getState().addIssue({
      code: 'translation_backlog',
      message: 'Translation is falling behind speech. Some captions are saved in English and can be translated later.',
      fatal: false,
    });
  },
  onError: (job, e) => {
    recordMetric('translation_failed');
    const msg = (e as Error)?.message ?? 'Translation failed';
    useSessionStore.getState().patchCaption(job.segmentId, { state: 'failed', error: msg });
  },
});

export function getTranslationQueueStats() {
  return queue.getStats();
}

function styleNeedsTranslation(style: TranslationStyle) {
  return style !== 'english';
}

async function runTranslationJob(job: TranslationJob) {
  const session = useSessionStore.getState();
  const style = session.meeting?.id === job.meetingId ? session.meeting.translationStyle : getSettings().translationStyle;
  const persist = session.meeting?.id === job.meetingId ? session.meeting.saveTranscript : true;
  const db = getDb();
  try {
    const glossary = await getActiveGlossary();
    const settings = getSettings();
    const result = await translateToHinglish(job.english, (t) => MeetLingoNative.translate(t, 8000), {
      style: style === 'simple_hinglish' ? 'simple_hinglish' : 'natural_hinglish',
      glossary,
      icu: (s) => MeetLingoNative.transliterateIcu(s),
      preferIcu: settings.preferIcuRomanization,
    });
    if (result.protectionFallback) recordMetric('glossary_protection_fallback');
    if (queue.isCancelled(job.meetingId)) return;
    if (persist) {
      await updateTranslation(db, job.segmentId, { hindiText: result.hindi, hinglishText: result.hinglish, state: 'translated' });
    }
    useSessionStore.getState().patchCaption(job.segmentId, {
      hindiText: result.hindi,
      hinglishText: result.hinglish,
      state: 'translated',
      error: null,
    });
    pushOverlay(style === 'devanagari' ? result.hindi : result.hinglish);
  } catch (e) {
    const err = e as { code?: string; message?: string };
    const msg =
      err.code === 'translation_model_missing'
        ? 'Hindi model not installed'
        : err.code === 'translation_timeout'
          ? 'Translation timed out'
          : err.message ?? 'Translation failed';
    if (persist) await updateTranslation(db, job.segmentId, { hindiText: null, hinglishText: null, state: 'failed', error: msg });
    throw new Error(msg);
  }
}

function pushOverlay(text: string) {
  try {
    if (isNativeAvailable && MeetLingoNative.isOverlayShowing()) MeetLingoNative.updateOverlay(text, 'LIVE · MeetLingo AI');
  } catch {
    /* overlay optional */
  }
}

async function onCaption(e: NativeCaptionEvent) {
  const store = useSessionStore.getState();
  const meeting = store.meeting;
  if (!meeting || e.meetingId !== meeting.id) return;
  if (e.state === 'interim') {
    if (finalsSeen.has(e.segmentId)) return; // never resurrect a finalised segment
    store.setInterim({ segmentId: e.segmentId, startMs: e.startMs, text: e.englishText });
    return;
  }
  if (finalsSeen.has(e.segmentId)) return;
  finalsSeen.add(e.segmentId);
  if (getSettings().dropFillerCaptions && isJunkCaption(e.englishText, e.endMs != null ? e.endMs - e.startMs : null)) {
    recordMetric('junk_caption_dropped');
    if (store.interim?.segmentId === e.segmentId) store.setInterim(null);
    return;
  }
  const translate = styleNeedsTranslation(meeting.translationStyle);
  const state = translate ? 'translation_pending' : 'final';
  let sequenceNo = e.sequenceNo;
  if (meeting.saveTranscript) {
    try {
      const saved = await upsertSegment(getDb(), {
        id: e.segmentId,
        meetingId: meeting.id,
        sequenceNo: e.sequenceNo,
        startMs: e.startMs,
        endMs: e.endMs ?? null,
        englishText: e.englishText,
        state,
      });
      sequenceNo = saved.sequenceNo;
    } catch (err) {
      recordMetric('segment_write_failed');
      store.addIssue({ code: 'storage_write_failed', message: `Could not save a caption: ${(err as Error).message}`, fatal: false });
    }
  }
  store.upsertCaption({
    segmentId: e.segmentId,
    sequenceNo,
    startMs: e.startMs,
    endMs: e.endMs ?? null,
    englishText: e.englishText,
    hindiText: null,
    hinglishText: null,
    state,
  });
  if (!translate) pushOverlay(e.englishText);
  if (translate) queue.enqueue({ segmentId: e.segmentId, meetingId: meeting.id, english: e.englishText });
}

function installListeners() {
  removeListeners();
  subs = [
    addNativeListener('onCaption', (e) => void onCaption(e)),
    addNativeListener('onAudioLevel', (e) => {
      if (e.mode === 'session') useSessionStore.getState().setLevel(e);
    }),
    addNativeListener('onSessionState', (e) => {
      const store = useSessionStore.getState();
      if (!store.meeting || (e.meetingId && e.meetingId !== store.meeting.id)) return;
      store.setNativeState(e.state, e.deviceName);
      if (store.meeting.saveTranscript && (e.state === 'paused' || e.state === 'listening')) {
        void setMeetingStatus(getDb(), store.meeting.id, e.state === 'paused' ? 'paused' : 'active');
      }
      if (e.state === 'idle' && e.reason && e.reason !== 'user') {
        // Stopped by the system / notification / an error: finalise honestly.
        void finishMeeting(e.reason === 'notification_stop' ? 'completed' : 'interrupted', e.reason);
      }
    }),
    addNativeListener('onEngineError', (e) => {
      const store = useSessionStore.getState();
      if (store.meeting && e.meetingId && e.meetingId !== store.meeting.id) return;
      if (e.code === 'mic_restored') {
        store.removeIssue('mic_silenced'); // good news: clear the warning instead of raising a new one
        return;
      }
      store.addIssue(e);
      recordMetric(`engine_error:${e.code}`);
    }),
    addNativeListener('onOverlayAction', () => {
      /* user closed overlay; nothing else to do */
    }),
  ];
}

function removeListeners() {
  subs.forEach((s) => s.remove());
  subs = [];
}

export class StartMeetingError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

/** Creates the meeting (when saving is on) and starts the native foreground capture service. */
export async function startMeeting(draft: MeetingDraft): Promise<string> {
  if (!isNativeAvailable) throw new StartMeetingError('native_unavailable', 'The on-device engine is not available in this build.');
  const store = useSessionStore.getState();
  if (store.meeting) throw new StartMeetingError('session_active', 'A meeting is already running.');
  const usable = resolveUsableAsrModel(useModelStore.getState());
  if (!usable) throw new StartMeetingError('model_missing', 'No verified speech model is installed. Download one in Model Manager.');

  const db = getDb();
  let meetingId: string;
  if (draft.saveTranscript) {
    const m = await createMeeting(db, {
      title: draft.title,
      mode: draft.mode,
      source: draft.source,
      saveTranscript: true,
      saveAudio: draft.saveAudio,
    });
    meetingId = m.id;
  } else {
    meetingId = (await import('@/utils/id')).uuid();
  }

  finalsSeen = new Set();
  store.setMeeting({
    id: meetingId,
    title: draft.title.trim() || 'Untitled meeting',
    mode: draft.mode,
    source: draft.source,
    startedAt: Date.now(),
    saveTranscript: draft.saveTranscript,
    saveAudio: draft.saveAudio,
    outputMode: draft.outputMode,
    translationStyle: draft.translationStyle,
    asrModelId: usable.model.id,
  });
  installListeners();

  try {
    await MeetLingoNative.startSession({
      meetingId,
      title: draft.title.trim() || 'Meeting',
      source: draft.source,
      model: usable.model,
      saveAudio: draft.saveAudio && draft.saveTranscript,
      startSequenceNo: 0,
      audio: getAudioOptions(),
    });
  } catch (e) {
    const err = e as { code?: string; message?: string };
    removeListeners();
    if (draft.saveTranscript) {
      // Nothing was captured: remove the empty meeting rather than leave a ghost entry.
      const { deleteMeeting } = await import('@/database/repositories/meetings');
      await deleteMeeting(db, meetingId);
    }
    useSessionStore.getState().endSession(null, err.code ?? 'start_failed');
    throw new StartMeetingError(err.code ?? 'start_failed', err.message ?? 'Could not start listening');
  }
  if (draft.keepAwake) {
    try {
      await activateKeepAwakeAsync(KEEP_AWAKE_TAG);
    } catch {
      /* not critical */
    }
  }
  if (getSettings().showOverlayDuringMeeting) {
    try {
      if (MeetLingoNative.canDrawOverlays()) await MeetLingoNative.showOverlay('', 'LIVE · MeetLingo AI');
    } catch {
      /* optional */
    }
  }
  return meetingId;
}

export async function pauseMeeting() {
  return MeetLingoNative.pauseSession();
}

export async function resumeMeeting() {
  return MeetLingoNative.resumeSession();
}

/** User stop: native stop drains ASR and emits the last final before resolving. */
export async function stopMeeting(): Promise<string | null> {
  const meeting = useSessionStore.getState().meeting;
  if (!meeting) return null;
  try {
    await MeetLingoNative.stopSession();
  } catch {
    /* already stopped */
  }
  return finishMeeting('completed', 'user');
}

let finishing = false;
async function finishMeeting(status: 'completed' | 'interrupted', reason: string): Promise<string | null> {
  const store = useSessionStore.getState();
  const meeting = store.meeting;
  if (!meeting || finishing) return meeting?.id ?? null;
  finishing = true;
  try {
    // Give late final events (flushed on stop) a moment to arrive, then let translations finish (bounded).
    await new Promise((r) => setTimeout(r, 300));
    await Promise.race([queue.drain(), new Promise((r) => setTimeout(r, 15000))]);
    if (meeting.saveTranscript) await endMeeting(getDb(), meeting.id, status);
    try {
      if (isNativeAvailable && MeetLingoNative.isOverlayShowing()) await MeetLingoNative.hideOverlay();
    } catch {
      /* ignore */
    }
    deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
    removeListeners();
    useSessionStore.getState().endSession(meeting.saveTranscript ? meeting.id : null, reason);
    return meeting.saveTranscript ? meeting.id : null;
  } finally {
    finishing = false;
  }
}

/** Retries translation for one saved segment (e.g. after installing the Hindi model). */
export async function retryTranslation(segmentId: string) {
  const seg = await getSegment(getDb(), segmentId);
  if (!seg) return;
  await updateTranslation(getDb(), segmentId, { hindiText: seg.hindiText, hinglishText: seg.hinglishText, state: 'translation_pending' });
  useSessionStore.getState().patchCaption(segmentId, { state: 'translation_pending', error: null });
  queue.enqueue({ segmentId, meetingId: seg.meetingId, english: seg.englishText });
  await queue.drain();
}

/** Retries all untranslated segments of a meeting. Returns how many were queued. */
export async function retryAllTranslations(meetingId: string) {
  const pending = await listUntranslated(getDb(), meetingId);
  for (const s of pending) queue.enqueue({ segmentId: s.id, meetingId, english: s.englishText });
  await queue.drain();
  return pending.length;
}

/** Re-translates a meeting's captions in a different style (used from Transcript Detail). */
export async function isMeetingActive(meetingId: string) {
  return useSessionStore.getState().meeting?.id === meetingId || (await getMeeting(getDb(), meetingId))?.status === 'active';
}

/** Live preference change: affects new captions only (existing captions keep their stored text). */
export function changeLivePreferences(p: { outputMode?: MeetingDraft['outputMode']; translationStyle?: TranslationStyle }) {
  useSessionStore.getState().updateMeetingPrefs(p);
}
