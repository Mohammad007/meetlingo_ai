import type { IconName } from '@/components/Icon';

export interface IssueInfo {
  title: string;
  explanation: string;
  fix: string;
  icon: IconName;
  action?: { label: string; route?: string; kind: 'route' | 'app_settings' | 'overlay_settings' | 'restart' };
}

/** Accurate, user-facing explanations for every engine/session error code. */
export const ISSUES: Record<string, IssueInfo> = {
  mic_permission_denied: {
    title: 'Microphone permission needed',
    explanation: 'Android has not granted MeetLingo access to the microphone, so no audio can be captured.',
    fix: 'Allow the microphone permission, then start the meeting again.',
    icon: 'mic-off',
    action: { label: 'Open app settings', kind: 'app_settings' },
  },
  mic_permission_revoked: {
    title: 'Microphone permission was revoked',
    explanation: 'The permission was removed while listening. Capture stopped immediately; captions saved so far are kept.',
    fix: 'Re-allow the microphone in settings and start a new session.',
    icon: 'mic-off',
    action: { label: 'Open app settings', kind: 'app_settings' },
  },
  mic_busy: {
    title: 'Microphone is in use by another app',
    explanation: 'Another app (often a phone or video call) is holding the microphone. Android does not let two apps record at once.',
    fix: 'End the call or close the other recording app, then retry. For calls on this phone, use the laptop-speaker workflow instead.',
    icon: 'mic-off',
    action: { label: 'Laptop meeting guide', route: '/meeting/laptop-guide', kind: 'route' },
  },
  mic_unavailable: {
    title: 'Microphone unavailable',
    explanation: 'The audio input could not be opened. A Bluetooth headset may have disconnected, or another app is using it.',
    fix: 'Disconnect/reconnect the headset or use the phone microphone, then retry.',
    icon: 'mic-off',
    action: { label: 'Run microphone test', route: '/diagnostics', kind: 'route' },
  },
  mic_lost: {
    title: 'Audio input stopped',
    explanation: 'The audio input stopped responding (device routing changed or the system reclaimed it). Capture was stopped safely.',
    fix: 'Start a new session. If it repeats, restart the phone.',
    icon: 'alert',
  },
  mic_silenced: {
    title: 'Android is silencing the microphone',
    explanation: 'Another app with higher priority (usually a call) took the microphone. MeetLingo receives silence until it is released.',
    fix: 'End the call or switch the meeting to laptop speakers near the phone.',
    icon: 'mic-off',
  },
  no_audio: {
    title: 'No audio detected',
    explanation: 'The microphone is open but the level has stayed near silence. The source may be muted, too far away, or playing into headphones.',
    fix: 'Unmute the meeting, raise the speaker volume, move the phone closer, and avoid laptop headphones.',
    icon: 'speaker',
    action: { label: 'Laptop meeting tips', route: '/meeting/laptop-guide', kind: 'route' },
  },
  model_missing: {
    title: 'Speech model missing',
    explanation: 'No verified offline speech model is installed, so speech cannot be recognised.',
    fix: 'Download the speech model once (Internet required), then everything runs offline.',
    icon: 'download',
    action: { label: 'Set up offline models', route: '/model-setup', kind: 'route' },
  },
  asr_load_failed: {
    title: 'Speech engine failed to start',
    explanation: 'The speech model files could not be loaded (possibly corrupted or incompatible with this CPU).',
    fix: 'Reinstall the model from Model Manager. The app requires an ARM64 phone.',
    icon: 'cpu',
    action: { label: 'Open Model Manager', route: '/models', kind: 'route' },
  },
  asr_crash: {
    title: 'Speech decoder stopped',
    explanation: 'The recogniser hit an internal error. Capture was stopped safely and all final captions were saved.',
    fix: 'Start a new session. Export diagnostics if it repeats.',
    icon: 'alert',
    action: { label: 'Diagnostics', route: '/diagnostics', kind: 'route' },
  },
  translation_model_missing: {
    title: 'Hindi model not installed',
    explanation: 'English captions are still saved. Hinglish needs the on-device Hindi translation model.',
    fix: 'Install the Hindi model, then use “Translate pending” on the transcript.',
    icon: 'translate',
    action: { label: 'Open Model Manager', route: '/models', kind: 'route' },
  },
  translation_backlog: {
    title: 'Translation is behind',
    explanation: 'Speech is arriving faster than the phone can translate. English captions are saved; untranslated ones can be retried later.',
    fix: 'Close other heavy apps or switch to “English only” output during fast discussions.',
    icon: 'translate',
  },
  storage_write_failed: {
    title: 'Could not save a caption',
    explanation: 'The local database rejected a write — usually because storage is full.',
    fix: 'Free some storage space. Check Diagnostics for disk space.',
    icon: 'database',
    action: { label: 'Diagnostics', route: '/diagnostics', kind: 'route' },
  },
  low_storage: {
    title: 'Storage is low',
    explanation: 'Less than 500 MB is free. Long meetings or audio recording may fail to save.',
    fix: 'Delete old meetings or recordings, or free space on the phone.',
    icon: 'database',
    action: { label: 'Meeting history', route: '/history', kind: 'route' },
  },
  foreground_service_not_allowed: {
    title: 'Android blocked the listening service',
    explanation: 'Android only allows the microphone service to start while MeetLingo is open on screen.',
    fix: 'Open the app, keep it on screen, and tap Start Listening again.',
    icon: 'shield',
  },
  playback_restricted: {
    title: 'Playback capture not permitted',
    explanation: 'Screen/audio capture consent is missing or expired, or the playing app does not allow capture. Call audio can never be captured by other apps.',
    fix: 'Use the laptop-speaker workflow, or re-run the compatibility check.',
    icon: 'phone',
    action: { label: 'Compatibility check', route: '/meeting/compatibility', kind: 'route' },
  },
  interrupted: {
    title: 'Meeting was interrupted',
    explanation: 'The app was closed or killed by Android. Capture did not continue after that point; captions saved before it are kept.',
    fix: 'Open the transcript from History. Disable battery optimisation for MeetLingo if this happens often.',
    icon: 'history',
    action: { label: 'Open history', route: '/history', kind: 'route' },
  },
  cloud_disconnected: {
    title: 'No cloud engine is used',
    explanation: 'MeetLingo V1 runs entirely on the phone. Losing Internet never affects live captions.',
    fix: 'Nothing to fix. Internet is only needed to download models.',
    icon: 'wifi-off',
  },
  session_active: {
    title: 'A meeting is already running',
    explanation: 'Only one meeting can be captured at a time.',
    fix: 'Return to the live meeting or stop it first.',
    icon: 'activity',
    action: { label: 'Go to live meeting', route: '/meeting/live', kind: 'route' },
  },
  native_unavailable: {
    title: 'On-device engine not available',
    explanation: 'This build does not include the native speech engine (for example Expo Go or web).',
    fix: 'Install the MeetLingo Android development or release build.',
    icon: 'cpu',
  },
};

export function issueInfo(code: string, fallbackMessage?: string): IssueInfo {
  return (
    ISSUES[code] ?? {
      title: 'Something went wrong',
      explanation: fallbackMessage ?? `Error code: ${code}`,
      fix: 'Try again. If it repeats, export diagnostics from Settings → Troubleshooting.',
      icon: 'alert',
      action: { label: 'Diagnostics', route: '/diagnostics', kind: 'route' },
    }
  );
}
