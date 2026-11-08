import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import {
  addNativeListener,
  isNativeAvailable,
  MeetLingoNative,
  type AudioInput,
  type AudioLevelEvent,
  type AudioTestStartResult,
} from '@/../modules/meetlingo-native';
import {
  AppHeader,
  AppText,
  Button,
  Card,
  ConfirmDialog,
  Divider,
  ErrorBanner,
  Icon,
  LevelMeter,
  LiveWaveform,
  Row,
  Screen,
  StatusChip,
} from '@/components';
import { startMeeting, StartMeetingError } from '@/services/meetingSession';
import { openAppSettings } from '@/services/permissions';
import { useUsableAsrModel } from '@/stores/modelStore';
import { useDraftStore } from '@/stores/sessionStore';
import { spacing, useAppTheme } from '@/theme';
import { getAudioOptions } from '@/stores/settingsStore';

const TEST_ID = '__audio_test__';

type Check = 'pass' | 'warn' | 'fail' | 'pending';

const START_ERROR_HELP: Record<string, { title: string; message: string; action?: { label: string; path?: string; settings?: boolean } }> = {
  model_missing: { title: 'Speech model missing', message: 'Install a verified speech model first.', action: { label: 'Set up models', path: '/model-setup' } },
  asr_load_failed: { title: 'Speech engine failed to load', message: 'The model files may be damaged. Reinstall the model.', action: { label: 'Model manager', path: '/models' } },
  foreground_service_not_allowed: {
    title: 'Android blocked the listening service',
    message: 'Keep MeetLingo open and visible, then tap Start Listening again. Android does not allow microphone services to start in the background.',
  },
  mic_busy: { title: 'Microphone in use', message: 'Another app (often a call) is using the microphone. End it or switch to the laptop-speaker route.' },
  mic_unavailable: { title: 'Microphone unavailable', message: 'The audio input could not be opened. Disconnect Bluetooth headsets and retry.' },
  mic_permission_denied: { title: 'Microphone permission needed', message: 'Allow microphone access in Android settings.', action: { label: 'Open settings', settings: true } },
  playback_restricted: { title: 'Capture consent missing', message: 'Grant screen-capture consent again from the compatibility screen.', action: { label: 'Compatibility', path: '/meeting/compatibility' } },
  session_active: { title: 'A meeting is already running', message: 'Return to the live meeting.', action: { label: 'Open live meeting', path: '/meeting/live' } },
  native_unavailable: { title: 'On-device engine unavailable', message: 'Install the Android development build to capture audio.' },
};

/** 08 Audio Test */
export default function AudioTestScreen() {
  const { colors } = useAppTheme();
  const draft = useDraftStore((s) => s.draft);
  const usable = useUsableAsrModel();

  const [level, setLevel] = useState<AudioLevelEvent | null>(null);
  const [startResult, setStartResult] = useState<AudioTestStartResult | null>(null);
  const [inputs, setInputs] = useState<AudioInput[]>([]);
  const [interim, setInterim] = useState('');
  const [finalText, setFinalText] = useState('');
  const [engineError, setEngineError] = useState<string | null>(null);
  const [startError, setStartError] = useState<{ code: string; message: string } | null>(null);
  const [starting, setStarting] = useState(false);
  const [confirmLow, setConfirmLow] = useState(false);
  const [runId, setRunId] = useState(0);

  // Rolling statistics over the last ~4 s (40 level events @ 10 Hz)
  const recent = useRef<AudioLevelEvent[]>([]);
  const levelCount = useRef(0);
  const [stats, setStats] = useState({ count: 0, peakDb: -120, noiseDb: -120, clipping: false });

  useEffect(() => {
    if (!draft) router.replace('/meeting/mode' as never);
  }, [draft]);

  useFocusEffect(
    useCallback(() => {
      if (!isNativeAvailable) return;
      let alive = true;
      recent.current = [];
      levelCount.current = 0;
      setLevel(null);
      setStats({ count: 0, peakDb: -120, noiseDb: -120, clipping: false });
      setInterim('');
      setFinalText('');
      setEngineError(null);
      setStartResult(null);

      const subs = [
        addNativeListener('onAudioLevel', (e) => {
          if (e.mode !== 'test') return;
          levelCount.current++;
          recent.current = [...recent.current.slice(-39), e];
          const peakDb = Math.max(...recent.current.map((x) => x.dbfs));
          setLevel(e);
          setStats({ count: levelCount.current, peakDb, noiseDb: e.noiseFloorDb, clipping: recent.current.some((x) => x.clipping) });
        }),
        addNativeListener('onCaption', (e) => {
          if (e.meetingId !== TEST_ID) return;
          if (e.state === 'interim') setInterim(e.englishText);
          else {
            setFinalText(e.englishText);
            setInterim('');
          }
        }),
        addNativeListener('onEngineError', (e) => {
          if (e.meetingId && e.meetingId !== TEST_ID) return;
          setEngineError(e.message);
        }),
      ];
      try {
        setInputs(MeetLingoNative.listAudioInputs());
      } catch {
        /* optional */
      }
      MeetLingoNative.startAudioTest(usable?.model ?? null, getAudioOptions())
        .then((r) => alive && setStartResult(r))
        .catch((e) => alive && setEngineError((e as Error).message));
      return () => {
        alive = false;
        subs.forEach((s) => s.remove());
        MeetLingoNative.stopAudioTest().catch(() => {});
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [runId, usable?.model.id]),
  );

  const micWorks = !!startResult?.ok && stats.count > 3;
  const asrReady = !!startResult?.asrReady;
  const levelCheck: Check = !micWorks ? 'pending' : stats.peakDb > -45 ? 'pass' : stats.peakDb < -55 ? 'warn' : 'pass';
  const noiseCheck: Check = !micWorks ? 'pending' : stats.noiseDb > -40 ? 'warn' : 'pass';
  const speechCheck: Check = !startResult ? 'pending' : !asrReady ? 'fail' : finalText || interim ? 'pass' : 'pending';
  const micCheck: Check = startResult && !startResult.ok ? 'fail' : micWorks ? 'pass' : 'pending';
  const lowLevel = micWorks && stats.peakDb < -45;

  const doStart = async () => {
    if (!draft) return;
    setConfirmLow(false);
    setStarting(true);
    setStartError(null);
    try {
      await MeetLingoNative.stopAudioTest().catch(() => {});
      await startMeeting(draft);
      router.replace('/meeting/live' as never);
    } catch (e) {
      const code = e instanceof StartMeetingError ? e.code : 'start_failed';
      setStartError({ code, message: (e as Error).message });
      setRunId((n) => n + 1); // restart the test so the user can retry
    } finally {
      setStarting(false);
    }
  };

  const onStartPressed = () => (lowLevel ? setConfirmLow(true) : void doStart());
  const help = startError ? START_ERROR_HELP[startError.code] : null;

  if (!isNativeAvailable) {
    return (
      <View style={{ flex: 1 }}>
        <AppHeader title="Test microphone" />
        <Screen>
          <ErrorBanner title={START_ERROR_HELP.native_unavailable.title} message={START_ERROR_HELP.native_unavailable.message} />
        </Screen>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <AppHeader title="Test microphone" subtitle={draft?.title} />
      <Screen
        footer={
          <Row>
            <Button label="Retry" kind="secondary" icon="refresh" onPress={() => setRunId((n) => n + 1)} style={{ flex: 1 }} />
            <Button
              label={lowLevel ? 'Start anyway' : 'Start Listening'}
              icon="mic"
              onPress={onStartPressed}
              loading={starting}
              disabled={!micWorks || !asrReady}
              style={{ flex: 1.4 }}
            />
          </Row>
        }>
        <AppText color={colors.textMuted}>Check that your microphone hears the meeting before you start.</AppText>

        <Card style={{ marginTop: spacing.md, gap: spacing.md, backgroundColor: colors.infoSurface, borderColor: 'transparent' }}>
          <LiveWaveform level={level} height={80} />
          <LevelMeter level={level} />
          <AppText variant="caption" color={colors.textMuted} style={{ textAlign: 'center' }}>
            {level ? `Level ${Math.round(level.dbfs)} dBFS · noise floor ${Math.round(level.noiseFloorDb)} dBFS` : 'Waiting for audio from the microphone…'}
          </AppText>
        </Card>

        <Card style={{ marginTop: spacing.md }}>
          <AppText variant="label" color={colors.textMuted}>SAY SOMETHING, FOR EXAMPLE</AppText>
          <AppText variant="heading" style={{ marginTop: 4 }}>“Please share the latest build.”</AppText>
          <Divider />
          {asrReady ? (
            finalText || interim ? (
              <AppText style={{ color: interim ? colors.interim : colors.text, fontStyle: interim ? 'italic' : 'normal' }}>{interim || finalText}</AppText>
            ) : (
              <AppText variant="caption" color={colors.textMuted}>Recognised English will appear here.</AppText>
            )
          ) : startResult ? (
            <AppText variant="caption" color={colors.danger}>
              Speech recognition is not available: {startResult.asrError ?? 'no verified speech model is installed'}.
            </AppText>
          ) : (
            <AppText variant="caption" color={colors.textMuted}>Starting test…</AppText>
          )}
        </Card>

        <Card style={{ marginTop: spacing.md, gap: 2 }}>
          <CheckRow label="Microphone working" state={micCheck} detail={startResult?.ok === false ? startResult.code ?? 'failed' : startResult?.deviceName} />
          <CheckRow
            label="Input level"
            state={levelCheck}
            detail={!micWorks ? undefined : stats.peakDb < -55 ? 'Too quiet — move closer or raise the volume' : stats.peakDb < -45 ? 'Low' : 'Good'}
          />
          <CheckRow label="Background noise" state={noiseCheck} detail={!micWorks ? undefined : stats.noiseDb > -40 ? 'Noisy room — captions may be less accurate' : 'Low'} />
          <CheckRow label="Speech recognised" state={speechCheck} detail={!asrReady && startResult ? 'Speech model missing' : speechCheck === 'pass' ? 'Yes' : 'Speak now'} />
          {stats.clipping ? <CheckRow label="Clipping" state="warn" detail="Too loud — lower the speaker volume" /> : null}
        </Card>

        {inputs.length ? (
          <Card style={{ marginTop: spacing.md }}>
            <AppText variant="label" color={colors.textMuted}>DETECTED INPUTS</AppText>
            {inputs.map((i) => (
              <Row key={i.id} style={{ marginTop: 6 }}>
                <Icon name={i.isBuiltIn ? 'mic' : 'headphones'} size={16} color={colors.textMuted} />
                <AppText variant="caption">{i.label}</AppText>
              </Row>
            ))}
            <AppText variant="caption" color={colors.textMuted} style={{ marginTop: 6 }}>
              Android routes to the active input automatically. Disconnect Bluetooth headsets to use the phone microphone.
            </AppText>
          </Card>
        ) : null}

        {engineError ? <ErrorBanner title="Audio problem" message={engineError} /> : null}
        {startError ? (
          <ErrorBanner
            title={help?.title ?? 'Could not start listening'}
            message={help ? `${help.message}\n(${startError.message})` : startError.message}
            action={
              help?.action
                ? { label: help.action.label, onPress: () => (help.action!.settings ? openAppSettings() : router.push(help.action!.path as never)) }
                : { label: 'Status & recovery', onPress: () => router.push(`/meeting/status?code=${startError.code}` as never) }
            }
          />
        ) : null}
      </Screen>

      <ConfirmDialog
        visible={confirmLow}
        title="Input level is low"
        message="The microphone hears very little. Captions may be missing or inaccurate. Move the phone closer to the speaker or raise the volume. Start anyway?"
        confirmLabel="Start anyway"
        onConfirm={() => void doStart()}
        onCancel={() => setConfirmLow(false)}
      />
    </View>
  );
}

function CheckRow({ label, state, detail }: { label: string; state: Check; detail?: string }) {
  const { colors } = useAppTheme();
  const tone = { pass: 'success', warn: 'warning', fail: 'danger', pending: 'neutral' } as const;
  const text = { pass: 'Pass', warn: 'Check', fail: 'Fail', pending: 'Waiting' }[state];
  return (
    <Row style={{ minHeight: 44, justifyContent: 'space-between' }}>
      <View style={{ flex: 1 }}>
        <AppText variant="bodyStrong">{label}</AppText>
        {detail ? <AppText variant="caption" color={colors.textMuted}>{detail}</AppText> : null}
      </View>
      <StatusChip label={text} tone={tone[state]} />
    </Row>
  );
}
