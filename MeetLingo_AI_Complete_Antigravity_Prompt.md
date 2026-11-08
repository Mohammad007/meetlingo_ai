# MeetLingo AI — Complete React Native Implementation Prompt

> **Implementation target:** Android-first React Native app that converts spoken English into continuously updated English + Roman-script Hinglish subtitles. **No backend, no login, no Firebase, no MySQL, no hosted proxy.** All meeting metadata, captions, glossary, preferences, and action items must be stored in **SQLite on the device**. Core live transcription and translation must work after required models have been downloaded, even with no Internet.

## Your role and delivery expectations

Act as a senior React Native/TypeScript, Kotlin/Android, offline speech recognition and on-device NLP engineer. Implement an actual working app, not just screens, not simulated streaming, and not hardcoded translations. Create code, native modules, local database, app screens, tests, assets, build instructions and a signed-release preparation guide. When a provider capability cannot work on Android, **state the limitation in the UI and implement the working fallback rather than faking it**. Build progressively, test on a real Android ARM64 phone, and continue through all modules. Avoid placeholder TODO features in the critical user journey.

## Non-negotiable rules

1. No cloud backend, API server, Laravel, Node server, Firebase, Supabase, custom hosted database, required account, or mandatory subscription. Do not invent a server to support features.
2. Offline-first, user-controlled: microphone -> locally processed English speech -> English text -> offline Hindi translation -> Roman-script Hinglish normalization -> live captions -> local SQLite.
3. Network is **not** required to start an already provisioned offline session. First-time speech and translation model downloads need Internet unless models are bundled.
4. Online operation means the same local pipeline works while connected, can download/update models, and **optionally** supports a user-configured direct-to-provider cloud engine when the provider supports a secure client integration. Never hardcode developer API secrets into the application, request a cloud provider credential from the user only when they explicitly opt in, store it securely (Android Keystore-backed secure storage), and warn about the limitations of direct mobile API credentials. If such integration is unsupported or insecure, disable the online AI toggle rather than implementing a fake connector.
5. Offline cloud fallback must never block local capture, freeze UI, corrupt saved captions or lose a buffered segment. Use bounded queues and local results as the source of truth.
6. Android does **not** universally permit recording Google Meet, Zoom or Teams call audio on the **same phone**. Android AudioPlaybackCapture only allows eligible playback usages and permitted capture policy, and communication/call audio commonly cannot be captured. Treat same-phone meeting capture as an *experimental, conditional capability* with MediaProjection consent and an explicit test. Do not use root, hidden APIs, accessibility abuse, call interception or bypass restrictions. If the source is unsupported, show a clear limitation and recommend joining the meeting on a laptop/other device and capturing its **speaker output with the phone microphone**.
7. Physical meeting and laptop-speaker meeting workflows must work with the microphone, regardless of the meeting platform. Headphones connected to the laptop may result in no audible audio at the phone: show a troubleshooting explanation.
8. Never claim speaker diarization, perfect translation, 0-latency captions, 100% source capture, offline generative summary, or speaker names unless demonstrably implemented; show 'Speaker' or omit it unless speaker identification is reliable.
9. User consent, visible recording/listening state, notification, delete/export controls and privacy-by-default are required. Do not record raw audio unless user opts in separately. Never transmit audio or transcripts without explicit opt-in.

## Platforms and stack

- React Native **bare workflow**, TypeScript, Gradle/Kotlin Android app (no Expo Go).
- React Navigation native stack + tabs; Zustand state; lightweight React Native SVG for waveform/icons if appropriate; React Native Reanimated only where useful and compatible.
- SQLite using a maintained native module (e.g., react-native-quick-sqlite or equivalent, selected after verifying compatibility), schema migrations with versioned SQL, transactions, indexes and optional FTS5 if supported by the shipped SQLite build.
- Native Kotlin audio pipeline using `AudioRecord` PCM mono 16 kHz or model-required sample rate, explicit resampling, bounded ring buffers, VAD, background threading, drop/overflow metrics and event throttling.
- Offline ASR: **sherpa-onnx** Android streaming model with actual endpoint support and callbacks. Choose a supported English streaming model after benchmark; models downloaded using checksummed assets with verified license metadata and version manifest. Provide small/standard model options only when tested.
- Offline translation: Google **ML Kit Translation** English -> Hindi, with `downloadModelIfNeeded`, model manager, proper lifecycle cleanup, on-device translation only after model availability is confirmed. Check attribution and product guideline requirements.
- Hindi Devanagari -> Latin romanization: Android ICU transliterator when available; use tested alternatives/fallbacks for minimum supported Android versions. Romanization alone is **not** natural Hinglish: add a phrase-level glossary, colloquial Hinglish normalization and optional user corrections. Preserve English technical terms.
- Network state check using a maintained NetInfo equivalent; app keeps processing locally during transitions.
- Exports: Android Storage Access Framework / share intent for TXT, SRT, and PDF. Any audio export is optional and requires separate recording consent.
- Android microphone foreground service: correct microphone service type and permissions, initiated while app visible. Show ongoing user-visible notification and respect newer Android background-start and while-in-use permission restrictions. Optional overlay requires explicit `SYSTEM_ALERT_WINDOW` approval; overlay never grants audio capture.
- UI style: white `#FFFFFF`, navy `#102846`, sky blue `#0EA5E9`, dark red `#B42332`, pale background `#F6F9FC`, text `#64748B`; **no gradients**. Minimal premium Android design, high contrast, clean iconography, light/dark caption surfaces, safe areas, tablet-responsiveness, meaningful empty/loading/error states.

## Mandatory user journeys

**A — First install:** splash -> onboarding (3 slides) -> microphone explanation and consent -> downloadable offline speech and translation models -> model verification -> home. If skipped, clearly show which functions are unavailable; do not falsely indicate offline ready. No sign-up.

**B — Physical meeting:** home -> choose physical -> meeting setup (title, caption mode, optional audio recording) -> audio test -> start foreground microphone service -> stream English interim captions and phrase-level final Hinglish -> pause/resume -> stop -> SQLite history -> transcript -> action items, local summary, export.

**C — Online meeting on laptop:** choose laptop meeting -> illustrated guidance: play meeting audio from laptop speakers near phone, avoid laptop headphones unless using a separate authorized input method -> audio test -> run same microphone pipeline. Do not pretend the phone has joined the meeting or extracted the call directly.

**D — Online meeting on same Android phone:** choose same-phone -> compatibility information -> consent-based test for supported playback capture only where Android allows -> if audio source is not available, clearly show 'This meeting application's call audio can't be captured on this phone' and provide the laptop/second-device microphone workflow; show overlay subtitles only for an independently supported source. Do not try to force microphone capture of the same call if mic resource is occupied.

**E — Poor/no Internet:** active offline meeting unaffected. If connection changes, update status only; avoid automatic switch to unconfigured remote engine. Download retries never block live captions.

## Implement ALL 26 app screens with complete navigation

### 01 Splash Screen
Logo, 'Understand every meeting', version indicator, local database migration, model status initialization, route to onboarding or home. No fake loading delays.

### 02 Onboarding Screen
Three polished panels: 'Listen in Real Time', 'Understand in Hinglish', 'Works Without Internet'. Next/back/skip, final Get Started, responsive illustrations created locally as SVG, persistent completion setting.

### 03 Permission & Consent Screen
Microphone required, notification used for recording service, overlay optional; permission rationale, Android request, denied/permanently denied flows, link to OS settings, transparency on what's stored.

### 04 Offline Model Setup Screen
ASR package and ML Kit Hindi package availability, estimated/actual size, sufficient storage, Wi-Fi-only option, downloaded bytes, progress, integrity checks, error/retry, model installed date/version, 'Use offline' only once validated.

### 05 Home Dashboard
Top logo/title, Offline Ready indicator based on verified model state, Start Meeting primary CTA, fast mode choices, recent sessions, History, Glossary and Settings tabs. No dead buttons.

### 06 Meeting Mode Selector
Physical meeting, laptop meeting, same-phone online meeting with clear limited-support label. Explain how audio will actually enter the app. Save chosen mode.

### 07 Meeting Setup
Meeting title, source, output mode (English + Hinglish / Hinglish only / English only), translation style, keep-screen-awake switch, store-transcript toggle (default on with user control), raw audio recording switch (default off), Start Listening.

### 08 Audio Test
Live VU meter/waveform (native energy levels throttled to JS), detected input device, silence/noise warning, test utterance and interim English, pass/fail statuses, start only when valid.

### 09 Live Transcription
Core UI: session title, elapsed time, source label, LIVE indicator, 'Offline AI Active' chip, scrollable bilingual caption cards with timestamps, English interim text in subdued color and stable Hinglish finals in sky blue, clear pause/resume/stop buttons, auto-scroll toggle, optional full-screen/overlay. Never use fake text in production runtime.

### 10 Full-Screen Captions
Large text, high contrast, black/navy/white selectable background, font +/- slider, original English toggle, keep awake, exit to session. Best for conference table use.

### 11 Floating Caption Overlay
Permission request, draggable small overlay, last committed Hinglish caption, source status, minimize/close, read-only content. Do not use overlay to intercept call audio. Show permission-disabled case.

### 12 Live Controls
Pause, resume, output mode, subtitle font, translation style, auto scroll, local engine state, optional cloud engine preference only if user-configured and supported, stop confirmation.

### 13 Meeting Status & Recovery
Mic unavailable, mic taken by another app, no audio detected, model missing, low storage, application killed/recovery, cloud disconnected, playback restricted, foreground service not allowed, recover action with accurate explanation.

### 14 Laptop Meeting Guide
Do not show fake QR pairing. Illustrate laptop speaker -> phone mic. Add actual microphone audio test shortcut, tips for speaker volume/position, headphones limitation, 'Start Laptop Meeting' CTA. Optional future peer-to-peer companion is out of scope for backend-free V1.

### 15 Online App Compatibility
Explain Google Meet, Zoom, Microsoft Teams: laptop-speaker route works using phone microphone; same-phone internal capture depends on Android/source policy and may not work. Provide 'Check Capture Compatibility' real device capability test and an honest unsupported screen. No misleading 'Connect Zoom/Teams account' UI without integration.

### 16 Meeting History
SQLite-sourced list by date with session title, date, duration, mode, caption count, search, sort, rename, deletion confirmation and swipe actions.

### 17 Transcript Detail
Timestamped English and Hinglish segments, edit corrected Hinglish, tap to copy, display language toggles, search and scroll-to-segment, export. Only show speaker labels if engine actually supports it.

### 18 Transcript Search
Search across both original and Hinglish; debounce, highlights, meeting/date filters, no-results state; FTS5 search if available with indexed fallback.

### 19 Local Meeting Summary
Make a clearly labeled **basic extractive offline summary** using sentence scoring and keyword extraction from saved captions; avoid fake LLM-like summaries or unsupported claims. Include key points and transcript citations/segment links. Allow user editing. Advanced AI refinement only if explicit online BYOK feature is actually implemented.

### 20 Action Items
Heuristically suggest tasks only from explicit request/commitment phrases; mark suggestions as 'Review suggested task', user can edit, assign, add due date, check complete, delete. Never invent attendees or deadlines.

### 21 Export & Share
TXT (bilingual), SRT (timestamps, Hinglish or English), PDF (professional two-column/stacked transcript); Android share intent; document picker; include metadata and privacy warning where appropriate.

### 22 Custom Glossary
CRUD local entries: preserve-English, translate-as, romanization override; sample tech words API, SDK, React Native, APK, dashboard, deployment, retest. Support precedence and case-insensitive phrase protection with safe word boundaries.

### 23 Language & Caption Preferences
Natural Hinglish, simple Hinglish, Hindi Devanagari, English, dual-language. Visual caption font size, auto-scroll, colors, offline model preference. Show limitations of heuristic Hinglish output.

### 24 Offline Model Manager
Model cards with actual version, source, license note, size, verified status; install, retry, update, delete (not while session active), storage checks. No arbitrary fabricated model sizes.

### 25 Settings & Privacy
Theme, caption appearance, local storage, retention, transcription-only vs audio saving, microphone/overlay permission checks, cloud opt-in and BYOK (if actually supported), export local data, delete all data with confirmation, attribution, privacy information. No login required.

### 26 Troubleshooting & Diagnostics
Run mic test, acoustic level, ASR test utterance, translator model status, SQLite write/read test, available disk space, network availability, same-phone capture support test; provide specific fixes and export diagnostic logs without user transcript/audio by default.

## Native architecture and concurrency

Make these modules:

- `MeetingAudioModule.kt`: permission-independent audio capture interface, audio source enumeration, start/stop/pause/resume with hard stop on permission revocation, rate conversion and bounded buffer.
- `MeetingForegroundService.kt`: user-visible microphone notification; Android-correct lifecycle, no silent background start.
- `SpeechRecognitionEngine.kt`: Sherpa decoder, VAD, partial/final segment events; native inference thread, model configuration and unload.
- `TranslationEngine.kt`: ML Kit English-to-Hindi, phrase stabilization, transliteration, protected vocabulary, normalization and final caption event.
- `ModelManager.kt`: model manifest, download lifecycle, SHA-256 verification, local availability and storage checks.
- `AndroidCaptureCapability.kt`: only optionally attempt user-consented MediaProjection and allowed playback capture, return clear `supported/unsupported/unavailable` results, never bypass call audio restrictions.
- `NativeMeetingBridge.kt`: typed events to TypeScript; throttle status and audio levels, never continuously send raw PCM across JS bridge.

Pipeline:

`AudioRecord PCM -> VAD -> streaming ASR partial -> final English sentence/phrase -> local ML Kit Hindi -> Devanagari-to-Latin -> glossary/normalization -> final bilingual caption -> SQLite transaction -> UI`.

Use stable segment UUID and explicit status `interim|final|translation_pending|translated|failed`. Interim text is ephemeral and may be replaced; never duplicate finalized segments when speech boundaries change. Serialize translation jobs and implement bounded backlog and cancellation. When translation fails, save English segment and display translation unavailable, allowing retry. No silent dropped captions without telemetry.

Target under 1 second for interim *when hardware supports it*, 1-3 seconds after utterance end for final Hinglish as a benchmark, **not guaranteed**. Measure real latency on devices, 30/60-minute sessions, thermal throttling and power usage. Use test coverage for no speech, low volume, overlapping speakers, accents, noisy room, airplane mode and app background/foreground transitions.

## SQLite local schema and migration system

Create real SQL migrations including these tables:

```sql
CREATE TABLE IF NOT EXISTS meetings (
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
);

CREATE TABLE IF NOT EXISTS transcript_segments (
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
);

CREATE INDEX IF NOT EXISTS idx_segments_meeting_time
  ON transcript_segments(meeting_id, start_ms);

CREATE TABLE IF NOT EXISTS glossary_entries (
  id TEXT PRIMARY KEY,
  source_phrase TEXT NOT NULL,
  replacement TEXT NOT NULL,
  rule_type TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  json_value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS installed_models (
  model_id TEXT PRIMARY KEY,
  model_kind TEXT NOT NULL,
  model_version TEXT NOT NULL,
  local_path TEXT,
  sha256 TEXT,
  size_bytes INTEGER,
  verified INTEGER NOT NULL DEFAULT 0,
  installed_at INTEGER
);

CREATE TABLE IF NOT EXISTS action_items (
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
);

CREATE TABLE IF NOT EXISTS meeting_summaries (
  meeting_id TEXT PRIMARY KEY,
  summary_text TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'local_extractive',
  updated_at INTEGER NOT NULL,
  FOREIGN KEY(meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
);
```

Enable foreign keys. Use transactions on final caption commits, handle database close on app lifecycle, and back up/export carefully. Track migration version in `PRAGMA user_version` or dedicated migrations table. Local transcript retention and deletion must work even if cloud features were previously enabled. On crash, recover last active meeting as 'interrupted' and show saved segments; don't pretend audio continued after process death.

## TypeScript data model

```ts
type MeetingMode = 'physical' | 'laptop' | 'same_phone';
type AudioSource = 'microphone' | 'permitted_playback';
type CaptionState = 'interim' | 'final' | 'translation_pending' | 'translated' | 'failed';

interface CaptionEvent {
  meetingId: string;
  segmentId: string;
  sequenceNo: number;
  startMs: number;
  endMs?: number;
  englishText: string;
  hindiText?: string;
  hinglishText?: string;
  state: CaptionState;
  confidence?: number;
  speakerLabel?: string;
}
```

Create typed repository methods for createMeeting, endMeeting, upsertSegment, updateTranslation, listMeetings, searchTranscript, saveCorrection, manageGlossary, saveActionItem, saveSummary, deleteMeeting, clearAllData, exportMeeting. Distinguish session-relative timestamps from Unix timestamps.

## Native Android permissions and privacy

- `RECORD_AUDIO`, foreground-service permissions and service type `microphone` when required, runtime notification permission where applicable, optional `SYSTEM_ALERT_WINDOW`, optional MediaProjection flow only for permitted playback capture.
- Ask only necessary permissions for the selected mode.
- Display a permanent in-app LIVE indicator and notification during actual capture.
- The user must manually start listening; stop immediately on command and release microphone resources.
- Do not record or save raw audio by default. If user opts in, document storage and retention and implement storage safely before exposing the toggle.
- Save meeting transcripts entirely locally. Never collect analytics/remote logs by default. If online mode is implemented, display a separate consent disclosure before sending content.
- `android:foregroundServiceType` and service initiation comply with current Android OS versions, including while-in-use restrictions.

## Optional online AI — backend-free rules

Primary flow **never needs a cloud provider**. Internet connected = offline models still run smoothly, plus the app can update/download models.

Optionally add a plugin-based online recognition/refinement adapter *only* if a documented provider supports direct secure Android client calls and the user personally configures credentials. No developer-owned secret in code/assets/BuildConfig. Do not attempt to mint ephemeral tokens without a server. Cloud is disabled by default, privacy disclosure required, and local sessions work independently. If incompatible, release V1 with no online cloud AI and clearly explain that online/offline connectivity are both supported by the local inference pipeline.

## Offline local summary and natural Hinglish expectations

ML Kit returns Hindi, not naturally mixed Hinglish. Transliteration yields Roman Hindi, not a conversational LLM output; implement curated English term preservation, normalization rules and editable corrections. Test translation accuracy with real technical meetings before presenting quality claims. For meeting summary, implement locally computed extractive keywords/key sentences; label it 'Basic offline summary', with no fabricated actions or deadlines. Any generative summary must run in a real locally supported model or in explicit opt-in configured online mode; never fake it.

## UI implementation details

- Components: AppHeader, StatusChip, MeetingModeCard, ModelDownloadRow, LiveWaveform, CaptionCard, CaptionTimeline, ActionBar, PermissionExplainCard, EmptyState, TranscriptSearchBar, SettingsRow, ConfirmDialog, LoadingButton, ErrorBanner.
- Color tokens and scalable typography; avoid gradients; use proper safe area and compact bottom navigation.
- Maintain accessible font sizes and minimum 44-48dp targets. Preserve important text while the keyboard is open and in landscape/tablet.
- Use skeleton/loading states only when data actually loads. No fake people, fake meetings or fake listening status outside clearly separated dev-only seeded UI previews.

## Error handling and validation

- Missing mic permission / permanently denied / mic busy / Bluetooth routing issues.
- Unsupported same-phone audio with honest explanation and working laptop/physical alternative.
- Model unavailable, failed download, disk full, checksum mismatch, unsupported ABI, no network for initial download.
- ASR decoder crash/restart (stop safely, preserve final SQLite captions), translation timeout, queue overload.
- App killed or Android background restrictions. Restore history but do not imply capture kept running when it did not.
- Meeting too long, low battery, thermal throttling, large transcripts and export storage permission errors.
- Empty speech (avoid inventing transcript), overlapping speech (do not hallucinate speaker labels), source audio muted.

## Test plan and acceptance criteria

1. Works fully offline after model provisioning, with airplane mode enabled, for physical microphone meeting.
2. When connected to Wi-Fi or cellular, local functionality remains operational without account/server.
3. Captions are real (native recognizer), not preset text; timestamps accurate; Hinglish derived from recognized content; technical words preserved by glossary.
4. 30 and 60-minute real sessions preserve all committed transcript segments even after UI navigation/background transitions that Android permits.
5. Pausing capture actually pauses microphone processing; stop releases mic; notification disappears; overlay closes.
6. Same-phone unsupported call audio is handled truthfully; no fake integrations and no illegal capture.
7. Every screen is responsive on 360dp+ Android and tablets, has full navigation and correct state/UI.
8. SQLite CRUD, search, migrations, delete and exports are covered by tests.
9. Model first-install / download/retry/delete/validation are functional, including offline-after-download behavior.
10. Action items and basic summaries show derivation and allow correction, never invent details.
11. App compiles and launches on a real Android device, with build command instructions and documented compatible versions.

## Deliverable project structure

```text
MeetLingoAI/
  android/app/src/main/java/.../
    audio/MeetingAudioModule.kt
    audio/MeetingForegroundService.kt
    asr/SpeechRecognitionEngine.kt
    translation/TranslationEngine.kt
    models/ModelManager.kt
    capture/AndroidCaptureCapability.kt
    bridge/NativeMeetingBridge.kt
  src/
    app/navigation/
    components/
    screens/          # all 26 complete screens
    features/meetings/
    features/captions/
    features/models/
    features/export/
    features/glossary/
    features/privacy/
    database/migrations/
    database/repositories/
    services/
    stores/
    hooks/
    theme/
    types/
    utils/
  assets/
  tests/
  README.md
  docs/architecture.md
  docs/android-permissions.md
  docs/model-licenses.md
  docs/audio-capture-limitations.md
```

## Implementation sequence

1. Scaffold a runnable bare React Native TypeScript Android project, navigation, theme and all 26 real UI screens.
2. Create versioned SQLite migrations/repositories and local seeded **development-only** preview data.
3. Implement Kotlin microphone capture, foreground service, permissions, status events and a real Audio Test screen.
4. Integrate Sherpa-ONNX streaming recognition and model manager with actual verified model files.
5. Implement ML Kit offline translation, Roman-script conversion, glossary and caption-state synchronization.
6. Finish production-ready live transcript view, full-screen captions, overlay and actual pause/resume/stop.
7. Implement history, transcript detail/search, basic offline summary, action items and export.
8. Implement supported-audio capability checks and honest same-phone restrictions; laptop microphone flow.
9. Add local model error handling, privacy settings, deletion, diagnostics and responsive layouts.
10. Execute tests, test APK on a real Android device, fix build/runtime bugs, and document release steps.

**IMPORTANT: Generate the code, not only a plan. At each stage, maintain a runnable build. Complete all 26 screens, real local engines, SQLite and functional navigation. Never pretend an unavailable audio source or unavailable cloud capability works.**
