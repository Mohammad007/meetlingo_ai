import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState, View } from 'react-native';

import { AppHeader, AppText, Button, Card, ErrorBanner, Icon, PermissionExplainCard, Row, Screen } from '@/components';
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
import { useSettingsStore } from '@/stores/settingsStore';
import { spacing, useAppTheme } from '@/theme';

/** 03 Permission & Consent */
export default function PermissionsScreen() {
  const { colors } = useAppTheme();
  const update = useSettingsStore((s) => s.update);
  const [mic, setMic] = useState<PermissionStatus | 'unknown'>('unknown');
  const [notif, setNotif] = useState<PermissionStatus | 'unknown'>('unknown');
  const [overlay, setOverlay] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    // Keep 'blocked' if the user permanently denied it; check() can only report granted/denied.
    const m = await checkMicrophone();
    setMic((prev) => (m === 'denied' && prev === 'blocked' ? 'blocked' : m));
    const n = await checkNotifications();
    setNotif((prev) => (n === 'denied' && prev === 'blocked' ? 'blocked' : n));
    setOverlay(canDrawOverlays());
  }, []);

  useEffect(() => {
    void refresh();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  const onMic = async () => {
    if (mic === 'blocked') return openAppSettings();
    setMic(await requestMicrophone());
  };
  const onNotif = async () => {
    if (notif === 'blocked') return openAppSettings();
    setNotif(await requestNotifications());
  };

  const onContinue = async () => {
    setBusy(true);
    try {
      await update({ permissionsReviewed: true });
      const done = useSettingsStore.getState().settings.modelSetupDone;
      router.replace((done ? '/home' : '/model-setup') as never);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AppHeader title="Permissions" back={router.canGoBack()} />
      <Screen
        edges={['bottom', 'left', 'right']}
        footer={
          <Button
            label={mic === 'granted' ? 'Continue' : 'Continue without microphone'}
            kind={mic === 'granted' ? 'primary' : 'secondary'}
            onPress={onContinue}
            loading={busy}
          />
        }>
        <View style={{ alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.infoSurface, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="mic" size={34} color={colors.primary} />
          </View>
          <AppText variant="title" accessibilityRole="header">Microphone access</AppText>
          <AppText color={colors.textMuted} style={{ textAlign: 'center' }}>
            Needed to hear the meeting, turn English speech into text and translate it into Hinglish on this phone.
            Listening only starts when you tap Start Listening.
          </AppText>
        </View>

        <PermissionExplainCard
          icon="mic"
          title="Microphone"
          required
          description="Captures meeting audio for live transcription. Audio is processed in memory on the device and released when you pause or stop."
          status={mic}
          actionLabel={mic === 'blocked' ? 'Open settings' : 'Allow microphone'}
          onAction={onMic}
        />
        {mic === 'blocked' ? (
          <ErrorBanner
            tone="warning"
            title="Microphone is blocked"
            message="Android won't show the permission prompt again. Open App settings → Permissions → Microphone and choose 'Allow only while using the app'."
            action={{ label: 'Open app settings', onPress: openAppSettings }}
          />
        ) : null}

        {needsNotificationPermission ? (
          <PermissionExplainCard
            icon="bell"
            title="Notifications"
            required={false}
            description="Shows the ongoing 'Listening' notification with Pause and Stop while a meeting is being captioned. Android requires this notification for microphone capture."
            status={notif}
            actionLabel={notif === 'blocked' ? 'Open settings' : 'Allow notifications'}
            onAction={onNotif}
          />
        ) : null}

        <PermissionExplainCard
          icon="layers"
          title="Display over other apps"
          required={false}
          description="Shows the last caption in a small floating window while you use other apps. It only displays captions — it cannot capture other apps' audio."
          status={overlay ? 'granted' : 'denied'}
          actionLabel="Open settings"
          onAction={openOverlaySettings}
        />

        {mic !== 'granted' ? (
          <ErrorBanner
            tone="info"
            title="Live captions need the microphone"
            message="You can continue and browse history, glossary and settings, but meetings can't be captioned until microphone access is allowed."
          />
        ) : null}

        <Card style={{ gap: spacing.sm, marginTop: spacing.md }}>
          <Row>
            <Icon name="shield" color={colors.primary} />
            <AppText variant="heading">What is stored</AppText>
          </Row>
          {[
            'Transcripts, summaries and glossary are stored only in a local SQLite database on this phone.',
            'No audio is saved unless you turn on audio recording for a specific meeting.',
            'Nothing is uploaded. There is no account, no server and no analytics.',
            'You can export or delete everything at any time from Settings.',
          ].map((t) => (
            <Row key={t} style={{ alignItems: 'flex-start' }}>
              <Icon name="check" size={18} color={colors.success} />
              <AppText variant="caption" style={{ flex: 1 }}>{t}</AppText>
            </Row>
          ))}
        </Card>
      </Screen>
    </View>
  );
}
