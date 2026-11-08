import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Switch, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ActionBar,
  AppText,
  Button,
  CaptionCard,
  ConfirmDialog,
  EmptyState,
  ErrorBanner,
  IconButton,
  LiveWaveform,
  Row,
  RoundControl,
  StatusChip,
} from '@/components';
import { isNativeAvailable, MeetLingoNative } from '@/../modules/meetlingo-native';
import { issueInfo } from '@/features/meetings/issues';
import { useElapsed } from '@/hooks/useElapsed';
import { useNetwork } from '@/hooks/useNetwork';
import { pauseMeeting, resumeMeeting, retryTranslation, stopMeeting } from '@/services/meetingSession';
import { useSessionStore, type LiveCaption } from '@/stores/sessionStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { spacing, useAppTheme } from '@/theme';
import { formatClock } from '@/utils/format';

const SOURCE_LABEL = {
  physical: 'Phone microphone · In-person',
  laptop: 'Phone microphone · Laptop speakers',
  same_phone: 'Same phone',
} as const;

/** 09 Live Transcription — real captions from the native recogniser only. */
export default function LiveRoute() {
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const meeting = useSessionStore((s) => s.meeting);
  const nativeState = useSessionStore((s) => s.nativeState);
  const captions = useSessionStore((s) => s.captions);
  const interim = useSessionStore((s) => s.interim);
  const level = useSessionStore((s) => s.level);
  const issues = useSessionStore((s) => s.issues);
  const lastEnded = useSessionStore((s) => s.lastEndedMeetingId);
  const lastEndReason = useSessionStore((s) => s.lastEndReason);
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);
  const elapsed = useElapsed();
  const net = useNetwork();
  const [confirmStop, setConfirmStop] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [dismissed, setDismissed] = useState<number>(0);
  const silentSince = useRef<number | null>(null);
  const [noAudio, setNoAudio] = useState(false);
  const listRef = useRef<FlatList<LiveCaption | { interim: true }>>(null);

  // "No audio detected" heuristic from real level events: >15 s below -60 dBFS while listening.
  useEffect(() => {
    if (nativeState !== 'listening' || !level) return;
    const now = level.receivedAt;
    if (level.dbfs < -60) silentSince.current ??= now;
    else silentSince.current = null;
    const silent = silentSince.current != null && now - silentSince.current > 15000;
    setNoAudio((prev) => (prev === silent ? prev : silent));
  }, [level, nativeState]);

  const data = useMemo(() => {
    const d: (LiveCaption | { interim: true })[] = [...captions];
    if (interim) d.push({ interim: true });
    return d;
  }, [captions, interim]);

  useEffect(() => {
    if (settings.autoScroll && data.length) {
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    }
  }, [data.length, interim?.text, settings.autoScroll]);

  const latestIssue = issues.filter((i) => i.at > dismissed).slice(-1)[0];

  if (!meeting) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <EmptyState
          icon="mic"
          title={lastEnded ? 'Meeting ended' : 'No meeting is running'}
          message={
            lastEnded
              ? lastEndReason && lastEndReason !== 'user'
                ? `Capture stopped (${issueInfo(lastEndReason.replace('capture_error:', '')).title}). Captions saved up to that point are in the transcript.`
                : 'Your transcript is saved on this phone.'
              : 'Start a meeting to see live captions here.'
          }
          action={
            lastEnded
              ? { label: 'Open transcript', onPress: () => router.replace({ pathname: '/transcript/[id]', params: { id: lastEnded } } as never) }
              : { label: 'Start a meeting', onPress: () => router.replace('/meeting/mode' as never) }
          }
        />
        <Button label="Back to home" kind="ghost" onPress={() => router.replace('/home' as never)} />
      </SafeAreaView>
    );
  }

  const paused = nativeState === 'paused';
  const live = nativeState === 'listening';

  const doStop = async () => {
    setStopping(true);
    const id = await stopMeeting();
    setStopping(false);
    setConfirmStop(false);
    if (id) router.replace({ pathname: '/transcript/[id]', params: { id } } as never);
    else router.replace('/home' as never);
  };

  const openOverlay = async () => {
    if (!isNativeAvailable || !MeetLingoNative.canDrawOverlays()) {
      router.push('/meeting/overlay' as never);
      return;
    }
    const last = [...captions].reverse().find((c) => c.hinglishText || c.englishText);
    await MeetLingoNative.showOverlay(last?.hinglishText ?? last?.englishText ?? '', 'LIVE · MeetLingo AI');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'left', 'right', 'bottom']}>
      {/* Header */}
      <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.xs, gap: spacing.xs }}>
        <Row>
          <IconButton icon="chevron-left" label="Back to home (meeting keeps running)" onPress={() => router.replace('/home' as never)} />
          <View style={{ flex: 1 }}>
            <AppText variant="heading" numberOfLines={1} accessibilityRole="header">{meeting.title}</AppText>
            <AppText variant="caption" color={colors.textMuted} numberOfLines={1}>
              {meeting.source === 'permitted_playback' ? 'Permitted playback capture' : SOURCE_LABEL[meeting.mode]}
            </AppText>
          </View>
          <IconButton icon="sliders" label="Live controls" onPress={() => router.push('/meeting/controls' as never)} />
        </Row>
        <Row style={{ flexWrap: 'wrap', paddingHorizontal: spacing.sm }}>
          {live ? (
            <StatusChip label={`LIVE ${formatClock(elapsed)}`} tone="live" />
          ) : paused ? (
            <StatusChip label={`PAUSED ${formatClock(elapsed)}`} tone="warning" icon="pause" />
          ) : (
            <StatusChip label="Starting…" tone="neutral" />
          )}
          <StatusChip label="Offline AI Active" tone="success" icon="cpu" />
          {net.online === false ? <StatusChip label="No Internet · not needed" tone="neutral" icon="wifi-off" /> : null}
          {!meeting.saveTranscript ? <StatusChip label="Not saving" tone="warning" /> : null}
        </Row>
        <Row style={{ justifyContent: 'space-between', paddingHorizontal: spacing.sm }}>
          <AppText variant="caption" color={colors.textMuted}>
            {meeting.translationStyle === 'english' ? 'English captions' : 'English → Hinglish'}
          </AppText>
          <Row>
            <AppText variant="caption" color={colors.textMuted}>Auto-scroll</AppText>
            <Switch
              value={settings.autoScroll}
              onValueChange={(v) => update({ autoScroll: v })}
              accessibilityLabel="Auto-scroll"
              trackColor={{ true: colors.primary, false: colors.border }}
              thumbColor="#FFFFFF"
            />
          </Row>
        </Row>
      </View>

      {latestIssue ? (
        <View style={{ paddingHorizontal: spacing.md }}>
          <ErrorBanner
            tone={latestIssue.fatal ? 'danger' : 'warning'}
            title={issueInfo(latestIssue.code, latestIssue.message).title}
            message={latestIssue.message}
            action={{ label: 'What to do', onPress: () => router.push({ pathname: '/meeting/status', params: { code: latestIssue.code } } as never) }}
            onDismiss={() => setDismissed(Date.now())}
          />
        </View>
      ) : noAudio ? (
        <View style={{ paddingHorizontal: spacing.md }}>
          <ErrorBanner
            tone="warning"
            title="No audio detected for 15 seconds"
            message="Check the meeting volume, unmute it, or move the phone closer."
            action={{ label: 'Troubleshoot', onPress: () => router.push({ pathname: '/meeting/status', params: { code: 'no_audio' } } as never) }}
          />
        </View>
      ) : null}

      {/* Captions */}
      <FlatList
        ref={listRef}
        data={data}
        keyExtractor={(item) => ('interim' in item ? `interim` : item.segmentId)}
        contentContainerStyle={{ padding: spacing.md, maxWidth: 820, width: '100%', alignSelf: 'center', flexGrow: 1 }}
        ListEmptyComponent={
          <EmptyState
            icon="mic"
            title={paused ? 'Paused' : 'Listening…'}
            message={paused ? 'The microphone is released. Tap Resume to continue.' : 'Captions appear here as soon as speech is recognised. Nothing is shown until real speech is detected.'}
          />
        }
        renderItem={({ item }) =>
          'interim' in item ? (
            interim ? (
              <CaptionCard
                startMs={interim.startMs}
                englishText={interim.text}
                hinglishText={null}
                state="interim"
                interim
                outputMode={meeting.outputMode}
                translationStyle={meeting.translationStyle}
                fontSize={settings.captionFontSize}
              />
            ) : null
          ) : (
            <CaptionCard
              startMs={item.startMs}
              englishText={item.englishText}
              hinglishText={item.hinglishText}
              hindiText={item.hindiText}
              state={item.state}
              error={item.error}
              outputMode={meeting.outputMode}
              translationStyle={meeting.translationStyle}
              fontSize={settings.captionFontSize}
              onRetry={meeting.saveTranscript ? () => void retryTranslation(item.segmentId) : undefined}
            />
          )
        }
      />

      {/* Status strip */}
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xs, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border }}>
        <Row>
          <View style={{ flex: 1 }}>
            <LiveWaveform level={live ? level : null} bars={Math.min(48, Math.round(width / 14))} height={28} active={live} />
          </View>
          <AppText variant="caption" color={colors.textMuted}>{live ? (level?.isSpeech ? 'Speech' : 'Listening…') : paused ? 'Mic released' : 'Starting'}</AppText>
        </Row>
      </View>

      <ActionBar>
        <RoundControl icon="list" label="Controls" onPress={() => router.push('/meeting/controls' as never)} />
        {paused ? (
          <RoundControl icon="play" label="Resume" tone="primary" onPress={() => void resumeMeeting()} disabled={nativeState !== 'paused'} />
        ) : (
          <RoundControl icon="pause" label="Pause" onPress={() => void pauseMeeting()} disabled={!live} />
        )}
        <RoundControl icon="stop" label="Stop" tone="danger" size={64} onPress={() => setConfirmStop(true)} />
        <RoundControl icon="layers" label="Overlay" onPress={() => void openOverlay()} />
        <RoundControl icon="expand" label="Full screen" onPress={() => router.push('/meeting/fullscreen' as never)} />
      </ActionBar>

      <ConfirmDialog
        visible={confirmStop}
        title="Stop this meeting?"
        message={
          meeting.saveTranscript
            ? 'The microphone will be released immediately. Remaining translations finish, then the transcript opens.'
            : 'The microphone will be released. Transcript saving is off, so these captions will not be kept.'
        }
        confirmLabel="Stop meeting"
        destructive
        loading={stopping}
        onConfirm={doStop}
        onCancel={() => setConfirmStop(false)}
      />
    </SafeAreaView>
  );
}
