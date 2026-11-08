import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { AppHeader, AppText, Button, Card, Icon, Row, Screen, SectionTitle } from '@/components';
import { isNativeAvailable, MeetLingoNative } from '@/../modules/meetlingo-native';
import { ISSUES, issueInfo, type IssueInfo } from '@/features/meetings/issues';
import { useNetwork } from '@/hooks/useNetwork';
import { checkMicrophone, openAppSettings, openOverlaySettings, type PermissionStatus } from '@/services/permissions';
import { selectAsrReady, useModelStore } from '@/stores/modelStore';
import { useSessionStore } from '@/stores/sessionStore';
import { spacing, useAppTheme } from '@/theme';
import { formatBytes } from '@/utils/format';

type Check = { label: string; ok: boolean | null; detail: string };

/** 13 Meeting Status & Recovery — accurate explanation and recovery action for each failure mode. */
export default function StatusRoute() {
  const { colors } = useAppTheme();
  const { code } = useLocalSearchParams<{ code?: string }>();
  const meeting = useSessionStore((s) => s.meeting);
  const nativeState = useSessionStore((s) => s.nativeState);
  const issues = useSessionStore((s) => s.issues);
  const models = useModelStore();
  const net = useNetwork();
  const [mic, setMic] = useState<PermissionStatus>('unavailable');
  const [freeBytes, setFreeBytes] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      checkMicrophone().then(setMic);
      try {
        if (isNativeAvailable) setFreeBytes(MeetLingoNative.getDeviceInfo().availableBytes);
      } catch {
        /* ignore */
      }
    }, []),
  );

  const focus = code ? issueInfo(code) : null;
  const checks: Check[] = [
    { label: 'Microphone permission', ok: mic === 'granted', detail: mic === 'granted' ? 'Allowed' : 'Not allowed' },
    {
      label: 'Listening service',
      ok: meeting ? nativeState === 'listening' || nativeState === 'paused' : null,
      detail: meeting ? `State: ${nativeState}` : 'No meeting running',
    },
    { label: 'Speech model', ok: selectAsrReady(models), detail: selectAsrReady(models) ? 'Installed and verified' : 'Missing or unverified' },
    {
      label: 'Hindi translation model',
      ok: models.translation?.downloaded ?? null,
      detail: models.translation?.downloaded ? 'Installed' : 'Not installed — English captions still work',
    },
    {
      label: 'Storage',
      ok: freeBytes == null ? null : freeBytes > 500 * 1024 * 1024,
      detail: freeBytes == null ? 'Unknown' : `${formatBytes(freeBytes)} free`,
    },
    { label: 'Internet', ok: null, detail: net.online ? 'Connected (not required for live captions)' : 'Offline (not required for live captions)' },
  ];
  const allGood = checks.every((c) => c.ok !== false);

  const runAction = (info: IssueInfo) => {
    const a = info.action;
    if (!a) return;
    if (a.kind === 'app_settings') openAppSettings();
    else if (a.kind === 'overlay_settings') openOverlaySettings();
    else if (a.route) router.push(a.route as never);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AppHeader title="Meeting status" subtitle="Recovery & troubleshooting" />
      <Screen>
        {focus ? (
          <Card style={{ gap: spacing.sm, borderColor: colors.danger }}>
            <Row>
              <Icon name={focus.icon} color={colors.danger} size={28} />
              <AppText variant="title" style={{ flex: 1 }}>{focus.title}</AppText>
            </Row>
            <AppText>{focus.explanation}</AppText>
            <AppText variant="bodyStrong">What to do</AppText>
            <AppText color={colors.textMuted}>{focus.fix}</AppText>
            {focus.action ? <Button label={focus.action.label} onPress={() => runAction(focus)} /> : null}
          </Card>
        ) : (
          <Card style={{ alignItems: 'center', gap: spacing.sm }}>
            <Icon name={allGood ? 'check-circle' : 'alert'} color={allGood ? colors.success : colors.warning} size={48} />
            <AppText variant="title">{allGood ? 'Everything is working' : 'Some checks need attention'}</AppText>
          </Card>
        )}

        <SectionTitle>Current checks</SectionTitle>
        <Card style={{ gap: spacing.sm }}>
          {checks.map((c) => (
            <Row key={c.label} style={{ minHeight: 44 }}>
              <Icon name={c.ok === false ? 'alert' : c.ok ? 'check-circle' : 'info'} color={c.ok === false ? colors.danger : c.ok ? colors.success : colors.textMuted} />
              <View style={{ flex: 1 }}>
                <AppText variant="bodyStrong">{c.label}</AppText>
                <AppText variant="caption" color={colors.textMuted}>{c.detail}</AppText>
              </View>
            </Row>
          ))}
        </Card>

        {issues.length ? (
          <>
            <SectionTitle>This session</SectionTitle>
            {[...issues].reverse().map((i) => (
              <Card key={`${i.code}-${i.at}`} style={{ marginBottom: spacing.sm, gap: 4 }}>
                <AppText variant="bodyStrong">{issueInfo(i.code).title}</AppText>
                <AppText variant="caption" color={colors.textMuted}>{new Date(i.at).toLocaleTimeString()} · {i.message}</AppText>
              </Card>
            ))}
          </>
        ) : null}

        <SectionTitle>Common problems</SectionTitle>
        {(['mic_busy', 'no_audio', 'model_missing', 'low_storage', 'interrupted', 'playback_restricted', 'foreground_service_not_allowed', 'cloud_disconnected'] as const).map((k) => {
          const info = ISSUES[k];
          return (
            <Card key={k} style={{ marginBottom: spacing.sm, gap: 4 }} onPress={() => router.setParams({ code: k })} accessibilityLabel={info.title}>
              <Row>
                <Icon name={info.icon} color={colors.primary} />
                <AppText variant="bodyStrong" style={{ flex: 1 }}>{info.title}</AppText>
                <Icon name="chevron-right" color={colors.textMuted} size={18} />
              </Row>
            </Card>
          );
        })}
        {meeting ? <Button label="Back to live meeting" kind="secondary" onPress={() => router.replace('/meeting/live' as never)} style={{ marginTop: spacing.md }} /> : null}
      </Screen>
    </View>
  );
}
