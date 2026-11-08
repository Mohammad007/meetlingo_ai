import { create } from 'zustand';

import type { MeetingMode, OutputMode, TranslationStyle } from '@/types';

export type ThemePref = 'system' | 'light' | 'dark';
export type CaptionBackground = 'navy' | 'black' | 'white';

export interface AppSettings {
  theme: ThemePref;
  outputMode: OutputMode;
  translationStyle: TranslationStyle;
  captionFontSize: number;
  fullscreenFontSize: number;
  captionBackground: CaptionBackground;
  showEnglishInFullscreen: boolean;
  autoScroll: boolean;
  keepAwake: boolean;
  wifiOnlyDownloads: boolean;
  asrModelId: string;
  /** Use Android ICU transliteration instead of MeetLingo's Hinglish rules (scholarly spelling). */
  preferIcuRomanization: boolean;
  /** 0 = keep forever. */
  retentionDays: number;
  saveTranscriptDefault: boolean;
  onboardingComplete: boolean;
  permissionsReviewed: boolean;
  modelSetupDone: boolean;
  lastMode: MeetingMode;
  showOverlayDuringMeeting: boolean;
  /** Audio processing (Preferences → Audio processing). */
  noiseSuppression: boolean;
  autoGain: boolean;
  voiceFilter: boolean;
  micDirection: 'auto' | 'towards_user' | 'away_from_user';
  /** Hide filler-only captions such as "uh", "hmm". */
  dropFillerCaptions: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  outputMode: 'dual',
  translationStyle: 'natural_hinglish',
  captionFontSize: 17,
  fullscreenFontSize: 34,
  captionBackground: 'navy',
  showEnglishInFullscreen: true,
  autoScroll: true,
  keepAwake: true,
  wifiOnlyDownloads: true,
  asrModelId: 'kroko-en-2025-08-06',
  preferIcuRomanization: false,
  retentionDays: 0,
  saveTranscriptDefault: true,
  onboardingComplete: false,
  permissionsReviewed: false,
  modelSetupDone: false,
  lastMode: 'physical',
  showOverlayDuringMeeting: false,
  noiseSuppression: true,
  autoGain: true,
  voiceFilter: true,
  micDirection: 'auto',
  dropFillerCaptions: true,
};

export const SETTINGS_KEY = 'prefs';

interface SettingsState {
  settings: AppSettings;
  loaded: boolean;
  /** Persistence hook installed at startup (writes to SQLite app_settings). */
  persist: ((s: AppSettings) => Promise<void>) | null;
  hydrate: (stored: Partial<AppSettings> | null, persist: (s: AppSettings) => Promise<void>) => void;
  update: (patch: Partial<AppSettings>) => Promise<void>;
  reset: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,
  persist: null,
  hydrate: (stored, persist) => set({ settings: { ...DEFAULT_SETTINGS, ...(stored ?? {}) }, loaded: true, persist }),
  update: async (patch) => {
    const next = { ...get().settings, ...patch };
    set({ settings: next });
    await get().persist?.(next);
  },
  reset: async () => {
    set({ settings: DEFAULT_SETTINGS });
    await get().persist?.(DEFAULT_SETTINGS);
  },
}));

export const getSettings = () => useSettingsStore.getState().settings;

/** Audio processing options passed to the native capture/ASR pipeline. */
export function getAudioOptions(s: AppSettings = getSettings()) {
  return { noiseSuppression: s.noiseSuppression, autoGain: s.autoGain, voiceFilter: s.voiceFilter, micDirection: s.micDirection };
}
