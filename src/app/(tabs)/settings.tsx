import Constants from 'expo-constants';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, Pressable, View } from 'react-native';

import { isNativeAvailable, MeetLingoNative } from '@/../modules/meetlingo-native';
import {
  AppHeader,
  AppText,
  Card,
  ConfirmDialog,
  ErrorBanner,
  Field,
  RadioList,
  Row,
  Screen,
  SectionTitle,
  Segmented,
  SettingsRow,
  StatusChip,
  ToggleRow,
} from '@/components';
import { getDb } from '@/database/db';
import { listActionItems } from '@/database/repositories/actionItems';
import { applyRetention, clearAllData, databaseStats } from '@/database/repositories/data';
import { listGlossary } from '@/database/repositories/glossary';
import { listMeetings } from '@/database/repositories/meetings';
import { listSegments } from '@/database/repositories/segments';
import { getSummary } from '@/database/repositories/summaries';
import { exportAllDataJson } from '@/features/export/exportService';
import { invalidateGlossary } from '@/features/glossary/glossaryCache';
import { ASR_MODELS, TRANSLATION_MODEL } from '@/features/models/manifest';
import {
  canDrawOverlays,
  checkMicrophone,
  checkNotifications,
  needsNotificationPermission,
  openAppSettings,
  openOverlaySettings,
  requestMicrophone,
  requestNotifications,
  type PermissionStatus,
} from '@/services/permissions';
import { selectOfflineReady, useModelStore } from '@/stores/modelStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useSettingsStore, type ThemePref } from '@/stores/settingsStore';
import { spacing, useAppTheme } from '@/theme';
import { formatBytes } from '@/utils/format';

type Stats = Awaited<ReturnType<typeof databaseStats>>;

const RETENTION_OPTIONS = [
  { value: '0', label: 'Keep forever', description: 'Meetings stay until you delete them.' },
  { value: '30', label: '30 days', description: 'Older meetings are deleted automatically on app start.' },
  { value: '90', label: '90 days' },
  { value: '365', label: '1 year' },
];

export default function SettingsScreen() {
  const { colors } = useAppTheme();
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);
  const offlineReady = useModelStore((s) => selectOfflineReady(s));
  const meetingActive = useSessionStore((s) => !!s.meeting);

  const [stats, setStats] = useState<Stats | null>(null);
  const [mic, setMic] = useState<PermissionStatus>('unavailable');
  const [notif, setNotif] = useState<PermissionStatus>('unavailable');
  const [overlay, setOverlay] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'danger' | 'info'; text: string } | null>(null);

  const [pendingRetention, setPendingRetention] = useState<{ days: number; count: number } | null>(null);
  const [confirmRecordings, setConfirmRecordings] = useState(false);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [deleteText, setDeleteText] = useState('');
  const [busy, setBusy] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      setStats(await databaseStats(getDb()));
    } catch {
      setStats(null);
    }
  }, []);

  const loadPermissions = useCallback(async () => {
    setMic(await checkMicrophone());
    setNotif(await checkNotifications());
    setOverlay(canDrawOverlays());
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadStats();
      void loadPermissions();
    }, [loadStats, loadPermissions]),
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void loadPermissions();
    });
    return () => sub.remove();
  }, [loadPermissions]);

  const onRetention = async (value: string) => {
    const days = Number(value);
    if (days > 0) {
      const cutoff = Date.now() - days * 86_400_000;
      const older = await listMeetings(getDb(), { toMs: cutoff });
      const count = older.filter((m) => m.status !== 'active' && m.status !== 'paused').length;
      if (count > 0) {
        setPendingRetention({ days, count });
        return;
      }
    }
    await update({ retentionDays: days });
  };

  const confirmRetention = async () => {
    if (!pendingRetention) return;
    setBusy(true);
    try {
      await update({ retentionDays: pendingRetention.days });
      const removed = await applyRetention(getDb(), pendingRetention.days);
      setMessage({ tone: 'success', text: `Retention set. ${removed.length} older meeting(s) deleted.` });
      await loadStats();
    } finally {
      setBusy(false);
      setPendingRetention(null);
    }
  };

  const deleteRecordings = () => {
    setConfirmRecordings(false);
    try {
      if (isNativeAvailable) MeetLingoNative.deleteAllRecordings();
      setMessage({ tone: 'success', text: 'All saved audio recordings were deleted.' });
    } catch (e) {
      setMessage({ tone: 'danger', text: (e as Error).message });
    }
  };

  const exportData = async () => {
    setBusy(true);
    try {
      const db = getDb();
      const meetings = await listMeetings(db, { limit: 100000 });
      const full = [];
      for (const m of meetings) {
        full.push({
          meeting: m,
          segments: await listSegments(db, m.id),
          actionItems: await listActionItems(db, m.id),
          summary: await getSummary(db, m.id),
        });
      }
      await exportAllDataJson({
        app: 'MeetLingo AI',
        exportedAt: new Date().toISOString(),
        version: Constants.expoConfig?.version ?? '1.0.0',
        meetings: full,
        glossary: await listGlossary(db),
      });
    } catch (e) {
      setMessage({ tone: 'danger', text: `Export failed: ${(e as Error).message}` });
    } finally {
      setBusy(false);
    }
  };

  const deleteAll = async () => {
    if (deleteText.trim() !== 'DELETE') return;
    setBusy(true);
    try {
      await clearAllData(getDb(), { keepOnboarding: true });
      try {
        if (isNativeAvailable) MeetLingoNative.deleteAllRecordings();
      } catch {
        /* no recordings */
      }
      invalidateGlossary();
      await useSettingsStore.getState().reset();
      await update({ onboardingComplete: true, permissionsReviewed: true, modelSetupDone: true });
      setMessage({ tone: 'success', text: 'All meetings, transcripts, summaries, action items, glossary and preferences were deleted. Downloaded models were kept.' });
      await loadStats();
    } catch (e) {
      setMessage({ tone: 'danger', text: `Delete failed: ${(e as Error).message}` });
    } finally {
      setBusy(false);
      setConfirmDeleteAll(false);
      setDeleteText('');
    }
  };

  const permChip = (s: PermissionStatus | boolean) => {
    const granted = s === true || s === 'granted';
    return <StatusChip label={granted ? 'Allowed' : s === 'blocked' ? 'Blocked' : 'Off'} tone={granted ? 'success' : s === 'blocked' ? 'danger' : 'neutral'} />;
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AppHeader title="Settings & Privacy" subtitle="No account · everything stays on this phone" back={false} />
      <Screen edges={['left', 'right']}>
        {message ? <ErrorBanner tone={message.tone} title={message.text} onDismiss={() => setMessage(null)} /> : null}

        <SectionTitle>Appearance</SectionTitle>
        <Segmented<ThemePref>
          accessibilityLabel="App theme"
          value={settings.theme}
          onChange={(v) => void update({ theme: v })}
          options={[
            { value: 'system', label: 'System' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
        />
        <Card style={{ marginTop: spacing.md, paddingVertical: spacing.xs }}>
          <SettingsRow icon="sliders" title="Language & caption preferences" subtitle="Hinglish style, font size, colours, auto-scroll" onPress={() => router.push('/preferences' as never)} />
          <SettingsRow
            icon="cpu"
            title="Offline models"
            subtitle="Speech recognition and Hindi translation"
            right={<StatusChip label={offlineReady ? 'Offline ready' : 'Setup needed'} tone={offlineReady ? 'success' : 'warning'} />}
            onPress={() => router.push('/models' as never)}
          />
        </Card>

        <SectionTitle>Storage & data</SectionTitle>
        <Card style={{ gap: spacing.sm }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <AppText variant="bodyStrong">Local database</AppText>
            <AppText variant="caption" color={colors.textMuted}>{stats ? formatBytes(stats.sizeBytes) : '—'}</AppText>
          </Row>
          <AppText variant="caption" color={colors.textMuted}>
            {stats ? `${stats.meetings} meetings · ${stats.segments} caption segments · ${stats.actionItems} action items · ${stats.glossary} glossary terms` : 'Loading…'}
          </AppText>
          <AppText variant="label" color={colors.textMuted} style={{ marginTop: spacing.sm }}>TRANSCRIPT RETENTION</AppText>
          <RadioList value={String(settings.retentionDays)} onChange={(v) => void onRetention(v)} options={RETENTION_OPTIONS} />
        </Card>

        <SectionTitle>Recording & transcripts</SectionTitle>
        <Card style={{ paddingVertical: spacing.xs }}>
          <ToggleRow
            icon="save"
            title="Save transcripts by default"
            subtitle="You can still change this for each meeting in Meeting Setup."
            value={settings.saveTranscriptDefault}
            onChange={(v) => void update({ saveTranscriptDefault: v })}
          />
          <SettingsRow
            icon="mic"
            title="Raw audio recording"
            subtitle="Off by default. Only saved when you switch it on for a specific meeting; stored privately inside the app."
          />
          <SettingsRow icon="trash" title="Delete all saved recordings" danger onPress={() => setConfirmRecordings(true)} />
        </Card>

        <SectionTitle>Permissions</SectionTitle>
        <Card style={{ paddingVertical: spacing.xs }}>
          <SettingsRow
            icon="mic"
            title="Microphone"
            subtitle="Required for live captions"
            right={permChip(mic)}
            onPress={async () => {
              if (mic === 'granted') return;
              const r = await requestMicrophone();
              if (r === 'blocked') openAppSettings();
              void loadPermissions();
            }}
          />
          {needsNotificationPermission ? (
            <SettingsRow
              icon="bell"
              title="Notifications"
              subtitle="Shows the ongoing 'Listening' notification"
              right={permChip(notif)}
              onPress={async () => {
                if (notif === 'granted') return;
                const r = await requestNotifications();
                if (r === 'blocked') openAppSettings();
                void loadPermissions();
              }}
            />
          ) : null}
          <SettingsRow
            icon="layers"
            title="Display over other apps"
            subtitle="Optional floating captions. It never captures other apps' audio."
            right={permChip(overlay)}
            onPress={() => openOverlaySettings()}
          />
          <SettingsRow icon="external" title="Open Android app settings" onPress={() => openAppSettings()} />
        </Card>

        <SectionTitle>Online AI</SectionTitle>
        <Card style={{ gap: spacing.sm }}>
          <ToggleRow icon="wifi" title="Cloud engine" subtitle="Not available in this version" value={false} onChange={() => {}} disabled />
          <AppText variant="caption" color={colors.textMuted}>
            MeetLingo runs fully on-device. There is no cloud engine, no API keys and nothing is uploaded. When you are online, the same local
            engines keep running; the Internet is only used to download models you choose.
          </AppText>
        </Card>

        <SectionTitle>Your data</SectionTitle>
        <Card style={{ paddingVertical: spacing.xs }}>
          <SettingsRow icon="download" title="Export my data" subtitle="JSON of meetings, captions, summaries, action items and glossary" onPress={busy ? undefined : exportData} />
          <SettingsRow
            icon="trash"
            title="Delete all data"
            subtitle={meetingActive ? 'Stop the active meeting first.' : 'Meetings, transcripts, summaries, action items, glossary and preferences'}
            danger
            onPress={meetingActive ? undefined : () => setConfirmDeleteAll(true)}
          />
        </Card>

        <SectionTitle>Help</SectionTitle>
        <Card style={{ paddingVertical: spacing.xs }}>
          <SettingsRow icon="activity" title="Troubleshooting & diagnostics" subtitle="Mic, models, storage and capture checks" onPress={() => router.push('/diagnostics' as never)} />
          <SettingsRow icon="refresh" title="Show onboarding again" onPress={() => router.push('/onboarding' as never)} />
        </Card>

        <SectionTitle>Privacy</SectionTitle>
        <Card style={{ gap: spacing.sm }}>
          {[
            'No login, no account and no subscription.',
            'No analytics and no remote logs. Diagnostic logs are only shared when you export them.',
            'Transcripts, summaries and glossary are stored only in this phone\'s local database.',
            'Audio is processed in memory and never stored unless you turn on recording for a meeting.',
            'Nothing leaves the device unless you export or share it yourself.',
            'App data is excluded from Android cloud backup.',
          ].map((t) => (
            <Row key={t} style={{ alignItems: 'flex-start' }}>
              <AppText color={colors.success}>✓</AppText>
              <AppText variant="caption" style={{ flex: 1 }}>{t}</AppText>
            </Row>
          ))}
        </Card>

        <SectionTitle>About & attribution</SectionTitle>
        <Card style={{ gap: spacing.sm }}>
          <AppText variant="bodyStrong">MeetLingo AI {Constants.expoConfig?.version ?? '1.0.0'}</AppText>
          <AppText variant="caption" color={colors.textMuted}>Speech recognition: sherpa-onnx (k2-fsa), Apache-2.0.</AppText>
          {ASR_MODELS.map((m) => (
            <Pressable key={m.id} onPress={() => Linking.openURL(m.licenseUrl)} accessibilityRole="link">
              <AppText variant="caption" color={colors.textMuted}>{m.name}: {m.license} ↗</AppText>
            </Pressable>
          ))}
          <Pressable onPress={() => Linking.openURL(TRANSLATION_MODEL.licenseUrl)} accessibilityRole="link">
            <AppText variant="caption" color={colors.textMuted}>{TRANSLATION_MODEL.name}: Translations by Google. {TRANSLATION_MODEL.license} ↗</AppText>
          </Pressable>
          <AppText variant="caption" color={colors.textMuted}>React Native and Expo: MIT licence.</AppText>
          <AppText variant="caption" color={colors.textMuted}>
            Hinglish output is produced by rule-based romanisation and may contain errors. MeetLingo does not identify speakers.
          </AppText>
        </Card>
      </Screen>

      <ConfirmDialog
        visible={!!pendingRetention}
        title="Delete older meetings?"
        message={pendingRetention ? `${pendingRetention.count} meeting(s) older than ${pendingRetention.days} days will be deleted now, and older meetings will keep being deleted on app start.` : undefined}
        confirmLabel="Delete & apply"
        destructive
        loading={busy}
        onCancel={() => setPendingRetention(null)}
        onConfirm={confirmRetention}
      />
      <ConfirmDialog
        visible={confirmRecordings}
        title="Delete all recordings?"
        message="Every saved meeting audio file will be permanently deleted. Transcripts are kept."
        confirmLabel="Delete"
        destructive
        onCancel={() => setConfirmRecordings(false)}
        onConfirm={deleteRecordings}
      />
      <ConfirmDialog
        visible={confirmDeleteAll}
        title="Delete all data?"
        message="This permanently deletes all meetings, transcripts, summaries, action items, glossary terms, recordings and preferences on this phone. Downloaded speech and translation models are kept (remove them in Model Manager). This cannot be undone."
        confirmLabel="Delete everything"
        destructive
        loading={busy}
        onCancel={() => { setConfirmDeleteAll(false); setDeleteText(''); }}
        onConfirm={deleteAll}>
        <Field label="Type DELETE to confirm" value={deleteText} onChangeText={setDeleteText} autoCapitalize="characters" autoCorrect={false} error={deleteText && deleteText.trim() !== 'DELETE' ? 'Type DELETE exactly' : null} />
      </ConfirmDialog>
    </View>
  );
}
