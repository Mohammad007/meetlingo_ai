import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import {
  AppHeader,
  AppText,
  Button,
  Card,
  ConfirmDialog,
  Divider,
  IconButton,
  RadioList,
  Row,
  Screen,
  Segmented,
  SectionTitle,
  SettingsRow,
  StatusChip,
  ToggleRow,
} from '@/components';
import { isNativeAvailable, MeetLingoNative, type SessionMetrics } from '@/../modules/meetlingo-native';
import { getAsrModel } from '@/features/models/manifest';
import { changeLivePreferences, getTranslationQueueStats, pauseMeeting, resumeMeeting, stopMeeting } from '@/services/meetingSession';
import { useSessionStore } from '@/stores/sessionStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { spacing, useAppTheme } from '@/theme';
import type { OutputMode, TranslationStyle } from '@/types';

const PROCESSING_LABEL: Record<string, string> = {
  voice_filter: 'Voice-only filter',
  noise_suppression: 'Noise suppression',
  auto_gain: 'Auto volume',
  mic_towards_user: 'Mic focus: screen side',
  mic_away_from_user: 'Mic focus: back side',
};

/** 12 Live Controls — modal over the live meeting. */
export default function ControlsRoute() {
  const { colors } = useAppTheme();
  const meeting = useSessionStore((s) => s.meeting);
  const nativeState = useSessionStore((s) => s.nativeState);
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);
  const [metrics, setMetrics] = useState<SessionMetrics | null>(null);
  const [queue, setQueue] = useState(getTranslationQueueStats());
  const [confirmStop, setConfirmStop] = useState(false);
  const [stopping, setStopping] = useState(false);

  useEffect(() => {
    const tick = () => {
      try {
        if (isNativeAvailable) setMetrics(MeetLingoNative.getSessionMetrics());
      } catch {
        /* ignore */
      }
      setQueue(getTranslationQueueStats());
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  if (!meeting) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <AppHeader title="Live controls" />
        <Screen>
          <AppText color={colors.textMuted}>No meeting is running.</AppText>
          <Button label="Close" kind="secondary" onPress={() => router.back()} style={{ marginTop: spacing.lg }} />
        </Screen>
      </View>
    );
  }

  const model = getAsrModel(meeting.asrModelId);
  const rtf = metrics?.realTimeFactor;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AppHeader title="Live controls" subtitle={meeting.title} right={<IconButton icon="x" label="Close" onPress={() => router.back()} />} back={false} />
      <Screen>
        <Card style={{ gap: spacing.md }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <View>
              <AppText variant="bodyStrong">{nativeState === 'paused' ? 'Paused' : nativeState === 'listening' ? 'Listening' : nativeState}</AppText>
              <AppText variant="caption" color={colors.textMuted}>
                {nativeState === 'paused' ? 'Microphone released' : 'Meeting audio is being processed on this phone'}
              </AppText>
            </View>
            {nativeState === 'paused' ? (
              <Button label="Resume" icon="play" compact onPress={() => void resumeMeeting()} />
            ) : (
              <Button label="Pause" icon="pause" kind="secondary" compact onPress={() => void pauseMeeting()} disabled={nativeState !== 'listening'} />
            )}
          </Row>
        </Card>

        <SectionTitle>Display</SectionTitle>
        <Segmented<OutputMode>
          accessibilityLabel="Output mode"
          value={meeting.outputMode}
          onChange={(v) => changeLivePreferences({ outputMode: v })}
          options={[
            { value: 'dual', label: 'Both' },
            { value: 'hinglish', label: 'Hinglish' },
            { value: 'english', label: 'English' },
          ]}
        />
        <Card style={{ marginTop: spacing.md }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <AppText variant="bodyStrong">Caption font size</AppText>
            <Row>
              <IconButton icon="minus" label="Smaller" onPress={() => update({ captionFontSize: Math.max(13, settings.captionFontSize - 1) })} background={colors.surfaceAlt} />
              <AppText variant="bodyStrong" style={{ minWidth: 32, textAlign: 'center' }}>{settings.captionFontSize}</AppText>
              <IconButton icon="plus" label="Larger" onPress={() => update({ captionFontSize: Math.min(30, settings.captionFontSize + 1) })} background={colors.surfaceAlt} />
            </Row>
          </Row>
          <Divider />
          <ToggleRow title="Auto scroll" value={settings.autoScroll} onChange={(v) => update({ autoScroll: v })} />
        </Card>

        <SectionTitle>Translation style</SectionTitle>
        <AppText variant="caption" color={colors.textMuted} style={{ marginBottom: spacing.sm }}>
          Applies to new captions. Captions already shown keep their saved text.
        </AppText>
        <RadioList<TranslationStyle>
          value={meeting.translationStyle}
          onChange={(v) => changeLivePreferences({ translationStyle: v })}
          options={[
            { value: 'natural_hinglish', label: 'Natural Hinglish', description: 'Common English words kept' },
            { value: 'simple_hinglish', label: 'Simple Hinglish', description: 'Romanised Hindi' },
            { value: 'devanagari', label: 'Hindi (Devanagari)' },
            { value: 'english', label: 'English only', description: 'Skips translation' },
            { value: 'dual_language', label: 'Hinglish + Devanagari' },
          ]}
        />

        <SectionTitle>Engine</SectionTitle>
        <Card style={{ gap: 2 }}>
          <SettingsRow icon="cpu" title="Speech recognition" subtitle={`${model?.name ?? meeting.asrModelId} · on-device (sherpa-onnx)`} right={<StatusChip label="Local" tone="success" />} />
          <SettingsRow icon="translate" title="Translation" subtitle="Google ML Kit · on-device" right={<StatusChip label="Local" tone="success" />} />
          <SettingsRow
            icon="activity"
            title="Performance"
            subtitle={
              metrics
                ? `Real-time factor ${rtf != null ? rtf.toFixed(2) : '—'} · dropped audio frames ${metrics.droppedFrames} · audio queue ${metrics.queueDepth}`
                : 'Metrics unavailable'
            }
          />
          <SettingsRow
            icon="sliders"
            title="Audio processing"
            subtitle={
              metrics?.processing?.length
                ? `${metrics.processing.map((p) => PROCESSING_LABEL[p] ?? p).join(' · ')}${
                    metrics.noiseSkippedMs ? ` · ${Math.round(metrics.noiseSkippedMs / 1000)} s of non-speech filtered` : ''
                  }${metrics.asrThreads ? ` · ${metrics.asrThreads} CPU threads` : ''}`
                : 'None active (change in Preferences → Audio processing)'
            }
          />
          <SettingsRow
            icon="list"
            title="Translation queue"
            subtitle={`Pending ${queue.pending} · done ${queue.processed} · failed ${queue.failed} · avg ${queue.avgLatencyMs ?? '—'} ms`}
          />
          <SettingsRow icon="wifi-off" title="Cloud engine" subtitle="Not available in this version. Everything runs on this phone." right={<StatusChip label="Off" tone="neutral" />} />
          {metrics?.deviceName ? <SettingsRow icon="mic" title="Input" subtitle={metrics.deviceName} /> : null}
        </Card>

        <Button label="Stop meeting" kind="danger" icon="stop" onPress={() => setConfirmStop(true)} style={{ marginTop: spacing.xl }} />
      </Screen>
      <ConfirmDialog
        visible={confirmStop}
        title="Stop this meeting?"
        message="The microphone is released immediately and the transcript is finalised."
        confirmLabel="Stop meeting"
        destructive
        loading={stopping}
        onCancel={() => setConfirmStop(false)}
        onConfirm={async () => {
          setStopping(true);
          const id = await stopMeeting();
          setStopping(false);
          setConfirmStop(false);
          router.dismissAll();
          if (id) router.replace({ pathname: '/transcript/[id]', params: { id } } as never);
          else router.replace('/home' as never);
        }}
      />
    </View>
  );
}
