import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import {
  addNativeListener,
  isNativeAvailable,
  MeetLingoNative,
  type AudioLevelEvent,
  type CaptureSupport,
  type CaptureTestResult,
} from '@/../modules/meetlingo-native';
import {
  AppHeader,
  AppText,
  Button,
  Card,
  ErrorBanner,
  Icon,
  LiveWaveform,
  Row,
  Screen,
  SectionTitle,
  StatusChip,
} from '@/components';
import { useSessionStore } from '@/stores/sessionStore';
import { spacing, useAppTheme } from '@/theme';

const APPS = [
  { name: 'Google Meet', note: 'Calls use Android voice-communication audio.' },
  { name: 'Zoom', note: 'Meeting audio is call audio; it typically blocks capture.' },
  { name: 'Microsoft Teams', note: 'Meeting audio is call audio; it typically blocks capture.' },
];

type Phase = 'idle' | 'consent' | 'testing' | 'done';

/** 15 Online App Compatibility */
export default function CompatibilityScreen() {
  const { colors } = useAppTheme();
  const activeMeeting = useSessionStore((s) => s.meeting);
  const [support, setSupport] = useState<CaptureSupport | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<CaptureTestResult | null>(null);
  const [level, setLevel] = useState<AudioLevelEvent | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!isNativeAvailable) return;
      try {
        setSupport(MeetLingoNative.getCaptureSupport());
      } catch (e) {
        setError((e as Error).message);
      }
      const sub = addNativeListener('onAudioLevel', (e) => {
        if (e.mode === 'capture_test') setLevel(e);
      });
      return () => sub.remove();
    }, []),
  );

  const runTest = async () => {
    setError(null);
    setResult(null);
    setLevel(null);
    setPhase('consent');
    try {
      const ok = await MeetLingoNative.requestCaptureConsent();
      if (!ok) {
        setPhase('idle');
        setError('Screen-capture consent was not granted, so playback capture cannot be tested.');
        return;
      }
      setPhase('testing');
      const r = await MeetLingoNative.runCaptureTest();
      setResult(r);
      setPhase('done');
    } catch (e) {
      setPhase('idle');
      setError((e as Error).message);
    }
  };

  const switchToPlayback = async () => {
    setError(null);
    try {
      // Consent tokens are single-use: the test consumed the previous one.
      const ok = await MeetLingoNative.requestCaptureConsent();
      if (!ok) {
        setError('Consent was not granted. Playback capture cannot be used.');
        return;
      }
      router.push('/meeting/setup?mode=same_phone&source=permitted_playback' as never);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const unsupported = support?.status === 'unsupported';

  return (
    <View style={{ flex: 1 }}>
      <AppHeader title="Online app compatibility" />
      <Screen>
        <Card style={{ backgroundColor: colors.successSurface, borderColor: 'transparent' }}>
          <Row style={{ alignItems: 'flex-start', gap: spacing.md }}>
            <Icon name="check-circle" color={colors.success} />
            <View style={{ flex: 1 }}>
              <AppText variant="bodyStrong" color={colors.success}>Works with every meeting app</AppText>
              <AppText variant="caption" color={colors.text}>
                Join on a laptop or another device and play the meeting through its speakers. This phone’s microphone listens.
              </AppText>
              <Button label="Laptop speaker guide" kind="secondary" compact onPress={() => router.push('/meeting/laptop-guide' as never)} style={{ marginTop: spacing.sm, alignSelf: 'flex-start' }} />
            </View>
          </Row>
        </Card>

        <SectionTitle>Same-phone capture</SectionTitle>
        <AppText color={colors.textMuted}>
          When the meeting runs on this same phone, Android decides what other apps may capture. Call audio uses the voice-communication
          stream, which third-party apps cannot record. Only media or game audio from apps that allow capture is available. The call app also
          usually holds the microphone; MeetLingo will not try to force it.
        </AppText>

        {APPS.map((a) => (
          <Card key={a.name} style={{ marginTop: spacing.sm, paddingVertical: spacing.md }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <AppText variant="bodyStrong">{a.name}</AppText>
                <AppText variant="caption" color={colors.textMuted}>Laptop speaker route: works. Same phone: {a.note}</AppText>
              </View>
              <StatusChip label="Usually blocked" tone="warning" />
            </Row>
          </Card>
        ))}

        {!isNativeAvailable ? (
          <ErrorBanner title="On-device engine unavailable" message="The compatibility test needs the Android development build." />
        ) : null}

        {support ? (
          <Card style={{ marginTop: spacing.md }}>
            <Row style={{ gap: spacing.sm }}>
              <StatusChip label={unsupported ? 'Not supported on this Android' : 'Conditional'} tone={unsupported ? 'danger' : 'warning'} />
            </Row>
            <AppText variant="caption" color={colors.text} style={{ marginTop: spacing.sm }}>{support.reason}</AppText>
          </Card>
        ) : null}

        {!unsupported && isNativeAvailable ? (
          <Card style={{ marginTop: spacing.md, gap: spacing.sm }}>
            <AppText variant="bodyStrong">Check capture compatibility</AppText>
            <AppText variant="caption" color={colors.textMuted}>
              1. Start playing the meeting or other audio on this phone. 2. Tap the button and accept Android’s screen-capture prompt. 3. MeetLingo
              listens to permitted playback for 5 seconds and reports exactly what it received. Nothing is saved.
            </AppText>
            {phase === 'testing' ? (
              <>
                <LiveWaveform level={level} height={56} />
                <AppText variant="caption" color={colors.textMuted}>Listening to permitted playback for 5 seconds…</AppText>
              </>
            ) : null}
            <Button
              label={phase === 'consent' ? 'Waiting for consent…' : phase === 'testing' ? 'Testing…' : result ? 'Run test again' : 'Check capture compatibility'}
              icon="activity"
              loading={phase === 'consent' || phase === 'testing'}
              disabled={!!activeMeeting}
              onPress={() => void runTest()}
            />
            {activeMeeting ? <AppText variant="caption" color={colors.warning}>Stop the active meeting before running the test.</AppText> : null}
          </Card>
        ) : null}

        {error ? <ErrorBanner title="Test not completed" message={error} /> : null}

        {result?.status === 'supported' ? (
          <Card style={{ marginTop: spacing.md, gap: spacing.sm, borderColor: colors.success }}>
            <Row>
              <Icon name="check-circle" color={colors.success} />
              <AppText variant="bodyStrong" color={colors.success}>Permitted playback audio received</AppText>
            </Row>
            <AppText variant="caption" color={colors.text}>
              {result.reason} Peak level {Math.round(result.peakDb ?? -120)} dBFS.
            </AppText>
            <AppText variant="caption" color={colors.textMuted}>
              Note: this proves that media from an app that allows capture can be heard. It does not prove meeting call audio is capturable.
            </AppText>
            <Button label="Use permitted playback capture" icon="speaker" onPress={() => void switchToPlayback()} />
          </Card>
        ) : null}

        {result && result.status !== 'supported' ? (
          <Card style={{ marginTop: spacing.md, gap: spacing.sm, borderColor: colors.danger, borderWidth: 2 }}>
            <Row style={{ alignItems: 'flex-start' }}>
              <Icon name="alert" color={colors.danger} />
              <AppText variant="heading" color={colors.danger} style={{ flex: 1 }}>
                This meeting application&apos;s call audio can&apos;t be captured on this phone
              </AppText>
            </Row>
            <AppText variant="caption" color={colors.text}>{result.reason}</AppText>
          </Card>
        ) : null}

        {(result && result.status !== 'supported') || unsupported ? (
          <>
            <SectionTitle>Working alternatives</SectionTitle>
            <Button label="Join on laptop, caption with phone mic" icon="laptop" onPress={() => router.push('/meeting/laptop-guide' as never)} />
            <Button
              label="Use phone mic with a second device"
              kind="secondary"
              icon="mic"
              onPress={() => router.push('/meeting/setup?mode=physical' as never)}
              style={{ marginTop: spacing.sm }}
            />
          </>
        ) : null}
      </Screen>
    </View>
  );
}
