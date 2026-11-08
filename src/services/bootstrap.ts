import { isNativeAvailable, MeetLingoNative } from '@/../modules/meetlingo-native';
import { openAppDatabase } from '@/database/db';
import { applyRetention } from '@/database/repositories/data';
import { seedDefaultGlossary } from '@/database/repositories/glossary';
import { recoverInterruptedMeetings } from '@/database/repositories/meetings';
import { getSetting, setSetting } from '@/database/repositories/settings';
import type { Meeting } from '@/types';
import { logEvent } from '@/services/telemetry';
import { useModelStore } from '@/stores/modelStore';
import { SETTINGS_KEY, useSettingsStore, type AppSettings } from '@/stores/settingsStore';

export interface BootResult {
  schemaVersion: number;
  migrationsApplied: string[];
  ftsAvailable: boolean;
  recovered: Meeting[];
  retentionRemoved: number;
  nativeAvailable: boolean;
}

/**
 * Real startup work (no artificial delays): open SQLite + migrate, load preferences, seed the glossary once,
 * mark crashed sessions as interrupted, apply retention, and query verified model state.
 */
export async function bootstrap(): Promise<BootResult> {
  const { db, report } = await openAppDatabase();
  // If the JS layer restarted while the native capture service kept running, nothing would save its
  // captions. Stop it honestly; the meeting is then marked 'interrupted' below.
  if (isNativeAvailable) {
    try {
      if (MeetLingoNative.getSessionMetrics().state !== 'idle') {
        await MeetLingoNative.stopSession();
        logEvent('warn', 'Stopped an orphaned capture session left running after an app reload');
      }
    } catch {
      /* best effort */
    }
  }
  const stored = await getSetting<Partial<AppSettings>>(db, SETTINGS_KEY);
  useSettingsStore.getState().hydrate(stored, (s) => setSetting(db, SETTINGS_KEY, s));
  await seedDefaultGlossary(db);
  const recovered = await recoverInterruptedMeetings(db);
  if (recovered.length) logEvent('warn', `Recovered ${recovered.length} interrupted meeting(s) after app restart`);
  const retentionDays = useSettingsStore.getState().settings.retentionDays;
  const removed = await applyRetention(db, retentionDays);
  await useModelStore.getState().refresh();
  logEvent('info', `Boot: schema v${report.toVersion}, fts=${report.ftsAvailable}, native=${isNativeAvailable}`);
  return {
    schemaVersion: report.toVersion,
    migrationsApplied: report.applied,
    ftsAvailable: report.ftsAvailable,
    recovered,
    retentionRemoved: removed.length,
    nativeAvailable: isNativeAvailable,
  };
}
