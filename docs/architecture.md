# Architecture

## Overview

```
 ┌──────────── Kotlin (modules/meetlingo-native) ─────────────┐        ┌──────────── TypeScript ────────────┐
 AudioRecord 16 kHz ─► 20 ms frames ─► EnergyVad ─► FrameQueue ─► sherpa-onnx ─► onCaption(interim|final) ─►  meetingSession.ts
 (or 48k ─► LinearResampler)              │        (bounded,      (inference    │                            │
                                          │         drop-oldest)   thread,      │                            ├─ interim → sessionStore (ephemeral)
                                          └► onAudioLevel (10 Hz)  endpoints)   │                            ├─ final  → SQLite txn (translation_pending)
                                                                                │                            │          → TranslationQueue (serial, bounded)
 ML Kit translate(EN→HI) ◄───────────────────── MeetLingoNative.translate ◄─────┼────────────────────────────┤             → mask glossary terms
 ICU Devanagari-Latin (API 29+) ◄────────────── transliterateIcu ◄──────────────┘                            │             → ML Kit → restore terms
                                                                                                             │             → romanise + normalise
                                                                                                             │          → SQLite (translated|failed) → UI → overlay
```

Raw PCM never crosses the JS bridge. Only level summaries (10 Hz) and caption text events do.

## Native layer

| File | Responsibility |
| --- | --- |
| `audio/MeetingAudioModule.kt` | `MeetingAudioCapture`: opens `AudioRecord` (VOICE_RECOGNITION → MIC fallback, or `AudioPlaybackCaptureConfiguration`), reads on a max-priority thread, resamples, frames, computes RMS/peak/VAD, writes optional WAV, detects permission revocation / dead input, registers `AudioRecordingCallback` to detect when Android silences the app (e.g. a call took the mic). `FrameQueue` drops the oldest frame on overflow and counts drops. |
| `audio/MeetingForegroundService.kt` | Enters the foreground with type `microphone` (plus `mediaProjection` only for permitted playback), shows an ongoing notification with Pause/Resume/Stop, stops on task removal (JS persistence is gone), never restarts sticky. |
| `asr/SpeechRecognitionEngine.kt` | Loads the sherpa-onnx `OnlineRecognizer` once (cached across sessions). `RecognitionWorker` drains the queue, decodes, emits throttled partials (~6 Hz) and one final per segment UUID on endpoint; flushes trailing audio on pause/stop; on crash emits the last hypothesis and an error. |
| `translation/TranslationEngine.kt` | ML Kit translator lifecycle, `isModelDownloaded` gate (never translates before the model is confirmed local), download/delete, translate with timeout; ICU transliteration on API 29+. |
| `models/ModelManager.kt` | Storage check → resumable HTTPS download (`.part` + `Range`, HTTPS-only redirects, 3 retries) → SHA-256 → extraction of only the manifest's files into a staging dir (path-traversal safe) → per-file size check → atomic rename + `installed.json`. Status re-verifies sizes on every query. |
| `capture/AndroidCaptureCapability.kt` | MediaProjection consent (single-use token), 5 s playback-capture test with a measured result: `supported` (signal), `unavailable` (silence/error), `unsupported` (< Android 10). |
| `overlay/CaptionOverlay.kt` | Draggable read-only `TYPE_APPLICATION_OVERLAY` window; requires user-granted permission. |
| `session/MeetingSessionController.kt` | State machine idle → starting → listening ⇄ paused → stopping → idle. Pause releases the microphone (new `AudioRecord` on resume). Session timestamps are wall-clock relative to the session start, so they stay aligned across pauses. |
| `bridge/NativeMeetingBridge.kt` | Expo module definition: functions + events (`onAudioLevel`, `onCaption`, `onSessionState`, `onEngineError`, `onModelProgress`, `onCaptureTest`, `onOverlayAction`). |

### Threads

`MeetLingo-Capture` (audio read), `MeetLingo-ASR` (decode), `MeetLingo-Session` (model load/start), `MeetLingo-Translate` (serial ML Kit calls), `MeetLingo-Models` (downloads), `MeetLingo-Bridge` (ML Kit model management). The JS thread only handles events.

## Audio processing ("focus on the meeting")

Configured in Preferences → Audio processing and passed with every session/audio test:

| Stage | Where | Effect |
| --- | --- | --- |
| Platform `NoiseSuppressor` / `AutomaticGainControl` | `MeetingAudioCapture.applyProcessing` | Hardware/DSP noise reduction and gain for quiet or distant speakers. Attached only if `isAvailable()`. |
| Preferred microphone direction | same (Android 10+) | `setPreferredMicrophoneDirection` towards/away from user on multi-mic phones. |
| Silero VAD voice gate | `VoiceGate` in `SpeechRecognitionEngine.kt` | Non-speech frames stay in a 480 ms pre-roll and never reach the recogniser; speech start replays the pre-roll; speech end finalises immediately with clean silence. Fewer noise-induced words, lower CPU, faster finals. |
| Endpoint | recogniser config | 0.6 s trailing silence (was 0.8 s); threads = cores/2 clamped to 2–4. |
| Junk-caption filter | `features/captions/junkFilter.ts` | Drops filler-only finals ("uh", "hmm") and sub-250 ms single words; real one-word answers are kept. |

What was actually enabled is reported back (`processing`, `noiseSkippedMs`) and shown in Live Controls — effects missing on a device are never claimed.

## Caption state machine

`interim` (memory only, replaced in place) → `final` → `translation_pending` → `translated` | `failed`.
Final segments are keyed by a UUID generated natively; `finalsSeen` in JS and `UNIQUE(meeting_id, sequence_no)` + id-based upsert in SQLite guarantee a finalised segment is never duplicated. Failed or dropped translations stay as English with a retry action; "Translate pending" re-queues them later (e.g. after installing the Hindi model).

## Hinglish pipeline (`src/features/captions/hinglish`)

1. **Protect** – glossary `preserve_english` / `translate_as` phrases are matched case-insensitively on whole words (longest first, non-overlapping) and replaced by `ZX<n>Q` placeholders.
2. **Translate** – ML Kit EN→HI.
3. **Restore** – placeholders are restored; if any is lost/duplicated, the unmasked sentence is translated instead and acronyms spelled in Devanagari (`एपीआई`) are restored (`API`). The fallback is counted in local telemetry.
4. **Romanise** – per token: user overrides → English loanword table (`डैशबोर्ड` → dashboard) → colloquial table (natural style: `कृपया` → please, `साझा` → share) → common spellings (`है` → hai, `नहीं` → nahi) → rule-based transliteration with schwa deletion (`समझना` → samajhna) or ICU when preferred.
5. **Tidy** – punctuation, spacing, sentence case.

Translation is phrase-level: only finals are translated, so Hinglish never flickers.

## Data

SQLite schema = spec tables + migration 2 (`corrected_hinglish`, `translation_error`, `assignee`, summary key points/keywords, indexes) + optional migration 3 (FTS5 external-content index with triggers). Session-relative times are `*_ms` columns; Unix times are `*_at`.
Startup (`services/bootstrap.ts`): open + migrate → load preferences → seed glossary once → mark `active`/`paused` meetings as `interrupted` (end = last caption) → apply retention → verify models.

## Privacy

- No network calls except model downloads (sherpa model from GitHub releases, ML Kit model via Google Play services).
- No analytics; `services/telemetry.ts` keeps counters in memory for the Diagnostics screen and user-initiated exports only (no transcript text).
- `allowBackup=false` so transcripts are not copied to cloud backups.
- Raw audio is saved only if enabled per meeting, as WAV in app-private storage, deletable from Transcript/Settings.

## Testing

`npm test` runs the repositories against Node's built-in SQLite (same SQL, FTS5, FK cascades), plus pure-logic tests for the Hinglish pipeline, translation queue, exports, summary and action items. On-device acceptance tests are listed in `docs/release.md`.
