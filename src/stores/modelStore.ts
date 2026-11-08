import { useMemo } from 'react';
import { create } from 'zustand';

import { addNativeListener, isNativeAvailable, MeetLingoNative, type NativeModelStatus } from '@/../modules/meetlingo-native';
import { getDb } from '@/database/db';
import { removeInstalledModel, upsertInstalledModel } from '@/database/repositories/models';
import { ASR_MODELS, getAsrModel, TRANSLATION_MODEL } from '@/features/models/manifest';
import { useSessionStore } from '@/stores/sessionStore';
import { getSettings, useSettingsStore } from '@/stores/settingsStore';

export interface DownloadProgress {
  phase: 'downloading' | 'verifying' | 'extracting' | 'installed' | 'error';
  downloadedBytes: number;
  totalBytes: number;
  error?: string;
  message?: string;
}

interface ModelState {
  asr: Record<string, NativeModelStatus | undefined>;
  translation: { downloaded: boolean; icuAvailable: boolean } | null;
  progress: Record<string, DownloadProgress | undefined>;
  checking: boolean;
  lastError: string | null;
  refresh: () => Promise<void>;
  downloadAsr: (id: string) => Promise<void>;
  cancelAsr: (id: string) => void;
  deleteAsr: (id: string) => Promise<void>;
  downloadTranslation: () => Promise<void>;
  deleteTranslation: () => Promise<void>;
}

let listenerInstalled = false;

export const useModelStore = create<ModelState>((set, get) => ({
  asr: {},
  translation: null,
  progress: {},
  checking: false,
  lastError: null,

  refresh: async () => {
    if (!isNativeAvailable) {
      set({ checking: false, lastError: 'Native engine unavailable in this build.' });
      return;
    }
    installListener(set, get);
    set({ checking: true });
    try {
      const asr: ModelState['asr'] = {};
      for (const m of ASR_MODELS) {
        const st = await MeetLingoNative.getModelStatus(m);
        asr[m.id] = st;
        await syncInstalledRow(m.id, st);
      }
      const translation = await MeetLingoNative.getTranslationModelStatus();
      await upsertInstalledModel(getDb(), {
        modelId: TRANSLATION_MODEL.id,
        modelKind: 'translation',
        modelVersion: TRANSLATION_MODEL.version,
        localPath: null,
        sha256: null,
        sizeBytes: null,
        verified: translation.downloaded,
        installedAt: translation.downloaded ? Date.now() : null,
      });
      set({ asr, translation, checking: false, lastError: null });
    } catch (e) {
      set({ checking: false, lastError: (e as Error).message });
    }
  },

  downloadAsr: async (id) => {
    const m = getAsrModel(id);
    if (!m) throw new Error('Unknown model');
    installListener(set, get);
    set((s) => ({ progress: { ...s.progress, [id]: { phase: 'downloading', downloadedBytes: 0, totalBytes: m.archiveBytes } } }));
    try {
      const st = await MeetLingoNative.downloadModel(m, getSettings().wifiOnlyDownloads);
      set((s) => ({ asr: { ...s.asr, [id]: st } }));
      await syncInstalledRow(id, st);
    } catch (e) {
      const err = e as { code?: string; message: string };
      set((s) => ({
        progress: { ...s.progress, [id]: { phase: 'error', downloadedBytes: 0, totalBytes: m.archiveBytes, error: err.code, message: err.message } },
      }));
      throw e;
    } finally {
      const st = await MeetLingoNative.getModelStatus(m).catch(() => undefined);
      if (st) set((s) => ({ asr: { ...s.asr, [id]: st } }));
    }
  },

  cancelAsr: (id) => {
    if (isNativeAvailable) MeetLingoNative.cancelModelDownload(id);
  },

  deleteAsr: async (id) => {
    const active = useSessionStore.getState().meeting;
    if (active) throw new Error('Stop the active meeting before deleting a speech model.');
    await MeetLingoNative.deleteModel(id);
    await removeInstalledModel(getDb(), id);
    set((s) => ({ progress: { ...s.progress, [id]: undefined } }));
    await get().refresh();
  },

  downloadTranslation: async () => {
    installListener(set, get);
    set((s) => ({ progress: { ...s.progress, [TRANSLATION_MODEL.id]: { phase: 'downloading', downloadedBytes: -1, totalBytes: -1 } } }));
    try {
      await MeetLingoNative.downloadTranslationModel(getSettings().wifiOnlyDownloads);
    } catch (e) {
      const err = e as { code?: string; message: string };
      set((s) => ({
        progress: { ...s.progress, [TRANSLATION_MODEL.id]: { phase: 'error', downloadedBytes: -1, totalBytes: -1, error: err.code, message: err.message } },
      }));
      throw e;
    } finally {
      await get().refresh();
    }
  },

  deleteTranslation: async () => {
    if (useSessionStore.getState().meeting) throw new Error('Stop the active meeting before deleting the translation model.');
    await MeetLingoNative.deleteTranslationModel();
    set((s) => ({ progress: { ...s.progress, [TRANSLATION_MODEL.id]: undefined } }));
    await get().refresh();
  },
}));

async function syncInstalledRow(id: string, st: NativeModelStatus) {
  const db = getDb();
  if (!st.installed) {
    await removeInstalledModel(db, id);
    return;
  }
  await upsertInstalledModel(db, {
    modelId: id,
    modelKind: 'asr',
    modelVersion: st.version ?? 'unknown',
    localPath: st.localPath,
    sha256: st.sha256 ?? null,
    sizeBytes: st.sizeBytes ?? null,
    verified: st.verified,
    installedAt: st.installedAt ?? null,
  });
}

function installListener(set: (fn: (s: ModelState) => Partial<ModelState>) => void, _get: () => ModelState) {
  if (listenerInstalled || !isNativeAvailable) return;
  listenerInstalled = true;
  addNativeListener('onModelProgress', (e) => {
    set((s) => ({
      progress: {
        ...s.progress,
        [e.modelId]: {
          phase: e.phase,
          downloadedBytes: e.downloadedBytes ?? 0,
          totalBytes: e.totalBytes ?? 0,
          error: e.error,
          message: e.message,
        },
      },
    }));
  });
}

/** Selectors */
export function selectAsrReady(s: ModelState, modelId = getSettings().asrModelId) {
  const st = s.asr[modelId];
  return !!st?.installed && !!st.verified;
}

export function selectOfflineReady(s: ModelState, modelId = getSettings().asrModelId) {
  return selectAsrReady(s, modelId) && !!s.translation?.downloaded;
}

/**
 * React hook form of resolveUsableAsrModel. Selects only a primitive (the model id) from the store so the
 * snapshot is stable; returning a fresh object from a Zustand selector causes an infinite render loop.
 */
export function useUsableAsrModel() {
  const id = useModelStore((s) => resolveUsableAsrModel(s)?.model.id ?? null);
  const preferred = useSettingsStore((s) => s.settings.asrModelId);
  return useMemo(() => (id ? { model: getAsrModel(id)!, fallback: id !== preferred } : null), [id, preferred]);
}

/** The selected ASR model if verified, otherwise any other verified model (with a flag). */
export function resolveUsableAsrModel(s: ModelState) {
  const preferred = getSettings().asrModelId;
  if (selectAsrReady(s, preferred)) return { model: getAsrModel(preferred)!, fallback: false };
  const other = ASR_MODELS.find((m) => selectAsrReady(s, m.id));
  return other ? { model: other, fallback: true } : null;
}
