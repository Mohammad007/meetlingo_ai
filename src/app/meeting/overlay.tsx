import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { AppState, View } from 'react-native';

import { AppHeader, AppText, Button, Card, ErrorBanner, PermissionExplainCard, Row, Screen, StatusChip, ToggleRow } from '@/components';
import { isNativeAvailable, MeetLingoNative } from '@/../modules/meetlingo-native';
import { canDrawOverlays, openOverlaySettings } from '@/services/permissions';
import { useSessionStore } from '@/stores/sessionStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { spacing, useAppTheme } from '@/theme';

/** 11 Floating Caption Overlay — read-only captions over other apps. Never captures their audio. */
export default function OverlayRoute() {
  const { colors } = useAppTheme();
  const meeting = useSessionStore((s) => s.meeting);
  const captions = useSessionStore((s) => s.captions);
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);
  const [allowed, setAllowed] = useState(canDrawOverlays());
  const [showing, setShowing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setAllowed(canDrawOverlays());
    try {
      setShowing(isNativeAvailable ? MeetLingoNative.isOverlayShowing() : false);
    } catch {
      setShowing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
      const sub = AppState.addEventListener('change', (s) => s === 'active' && refresh());
      return () => sub.remove();
    }, [refresh]),
  );

  const last = [...captions].reverse().find((c) => c.hinglishText || c.englishText);

  const show = async () => {
    setError(null);
    try {
      const ok = await MeetLingoNative.showOverlay(last?.hinglishText ?? last?.englishText ?? '', meeting ? 'LIVE · MeetLingo AI' : 'MeetLingo AI · not listening');
      if (!ok) setError('Android did not allow the overlay. Grant “Display over other apps” first.');
      refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const hide = async () => {
    await MeetLingoNative.hideOverlay();
    refresh();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AppHeader title="Floating captions" subtitle="Optional overlay" />
      <Screen>
        <ErrorBanner
          tone="info"
          title="What the overlay can and cannot do"
          message="It shows the latest caption from MeetLingo's microphone pipeline on top of other apps. It does not record or capture audio from Meet, Zoom, Teams or any other app."
        />
        {!isNativeAvailable ? <ErrorBanner title="Not available in this build" message="Install the Android build to use the overlay." /> : null}
        <PermissionExplainCard
          icon="layers"
          title="Display over other apps"
          required={false}
          description="Android requires you to enable this in system settings. You can turn it off any time."
          status={allowed ? 'granted' : 'denied'}
          actionLabel="Open settings"
          onAction={openOverlaySettings}
        />
        <Card style={{ gap: spacing.md }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <AppText variant="heading">Overlay</AppText>
            <StatusChip label={showing ? 'Showing' : 'Hidden'} tone={showing ? 'success' : 'neutral'} />
          </Row>
          <AppText variant="caption" color={colors.textMuted}>
            {meeting
              ? 'Shows the last committed Hinglish caption. Drag it to move; use – to minimise and ✕ to close.'
              : 'No meeting is running, so the overlay will only show a waiting message.'}
          </AppText>
          {!allowed ? (
            <AppText variant="caption" color={colors.warning}>Permission is off — the overlay cannot be shown until you allow it.</AppText>
          ) : null}
          <Row>
            <Button label="Show overlay" icon="layers" onPress={show} disabled={!allowed || !isNativeAvailable || showing} style={{ flex: 1 }} />
            <Button label="Hide" kind="secondary" onPress={hide} disabled={!showing} style={{ flex: 1 }} />
          </Row>
          {error ? <AppText variant="caption" color={colors.danger}>{error}</AppText> : null}
        </Card>
        <Card style={{ marginTop: spacing.md }}>
          <ToggleRow
            title="Show overlay when a meeting starts"
            subtitle="Only if the permission is granted."
            value={settings.showOverlayDuringMeeting}
            onChange={(v) => update({ showOverlayDuringMeeting: v })}
            disabled={!allowed}
          />
        </Card>
      </Screen>
    </View>
  );
}
