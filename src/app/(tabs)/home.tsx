import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';

import {
  AppText,
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  Icon,
  IconButton,
  Logo,
  Row,
  Screen,
  SectionTitle,
  StatusChip,
  Wordmark,
  type IconName,
} from '@/components';
import { getDb } from '@/database/db';
import { listMeetings } from '@/database/repositories/meetings';
import { useNetwork } from '@/hooks/useNetwork';
import { useAppStore } from '@/stores/appStore';
import { selectAsrReady, selectOfflineReady, useModelStore } from '@/stores/modelStore';
import { useDraftStore, useSessionStore } from '@/stores/sessionStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { radius, spacing, TOUCH, useAppTheme } from '@/theme';
import type { MeetingListItem, MeetingMode } from '@/types';
import { formatDateTime, formatDuration } from '@/utils/format';

const go = (path: string) => router.push(path as never);

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/** 05 Home Dashboard */
export default function HomeScreen() {
  const { colors } = useAppTheme();
  const net = useNetwork();
  const offlineReady = useModelStore((s) => selectOfflineReady(s));
  const asrReady = useModelStore((s) => selectAsrReady(s));
  const translationReady = useModelStore((s) => !!s.translation?.downloaded);
  const checking = useModelStore((s) => s.checking);
  const modelError = useModelStore((s) => s.lastError);
  const recovered = useAppStore((s) => s.boot?.recovered ?? []);
  const dismissRecovered = useAppStore((s) => s.dismissRecovered);
  const activeMeeting = useSessionStore((s) => s.meeting);
  const settings = useSettingsStore((s) => s.settings);
  const setDraft = useDraftStore((s) => s.setDraft);
  const [meetings, setMeetings] = useState<MeetingListItem[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      listMeetings(getDb(), { limit: 5 })
        .then((m) => alive && (setMeetings(m), setLoadError(null)))
        .catch((e) => alive && setLoadError((e as Error).message));
      return () => {
        alive = false;
      };
    }, []),
  );

  const quickStart = (mode: MeetingMode) => {
    void useSettingsStore.getState().update({ lastMode: mode });
    setDraft({
      title: '',
      mode,
      source: 'microphone',
      outputMode: settings.outputMode,
      translationStyle: settings.translationStyle,
      saveTranscript: settings.saveTranscriptDefault,
      saveAudio: false,
      keepAwake: settings.keepAwake,
    });
    if (mode === 'laptop') go('/meeting/laptop-guide');
    else if (mode === 'same_phone') go('/meeting/compatibility');
    else go(`/meeting/setup?mode=${mode}`);
  };

  const missing: string[] = [];
  if (!asrReady) missing.push('English speech model');
  if (!translationReady) missing.push('Hindi translation model');

  return (
    <Screen edges={['top', 'left', 'right']}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Row>
          <Logo size={36} />
          <Wordmark color={colors.text} size={22} />
        </Row>
        <IconButton icon="settings" label="Settings" onPress={() => go('/settings')} />
      </Row>

      <View style={{ marginTop: spacing.lg, gap: 4 }}>
        <AppText variant="title">{greeting()}</AppText>
        <AppText color={colors.textMuted}>Ready to caption your next meeting?</AppText>
      </View>

      {recovered.length > 0 ? (
        <ErrorBanner
          tone="warning"
          title={recovered.length === 1 ? 'A meeting was interrupted' : `${recovered.length} meetings were interrupted`}
          message={`"${recovered[0].title}" stopped when the app closed. Saved captions are kept; capture did not continue after that point.`}
          action={{ label: 'Open transcript', onPress: () => go(`/transcript/${recovered[0].id}`) }}
          onDismiss={dismissRecovered}
        />
      ) : null}

      {activeMeeting ? (
        <Card onPress={() => go('/meeting/live')} accessibilityLabel="Open meeting in progress" style={{ marginTop: spacing.md, borderColor: colors.danger, borderWidth: 2 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1, gap: 4 }}>
              <StatusChip label="LIVE" tone="live" />
              <AppText variant="heading" numberOfLines={1}>{activeMeeting.title}</AppText>
              <AppText variant="caption" color={colors.textMuted}>Meeting in progress · tap to return</AppText>
            </View>
            <Icon name="chevron-right" color={colors.textMuted} />
          </Row>
        </Card>
      ) : null}

      <Card style={{ marginTop: spacing.md, backgroundColor: offlineReady ? colors.successSurface : colors.warningSurface, borderColor: 'transparent' }}>
        <Row style={{ alignItems: 'flex-start', gap: spacing.md }}>
          <Icon name={offlineReady ? 'check-circle' : 'alert'} color={offlineReady ? colors.success : colors.warning} size={26} />
          <View style={{ flex: 1, gap: 4 }}>
            <AppText variant="bodyStrong" color={offlineReady ? colors.success : colors.warning}>
              {checking ? 'Checking installed models…' : offlineReady ? 'Offline ready' : asrReady ? 'English captions ready' : 'Not ready for offline use'}
            </AppText>
            <AppText variant="caption" color={colors.text}>
              {offlineReady
                ? 'Speech and Hindi models are installed and verified. Captions work without Internet.'
                : modelError
                  ? modelError
                  : `Missing: ${missing.join(' and ')}.${asrReady ? ' Captions will be English-only until the Hindi model is installed.' : ''}`}
            </AppText>
            <Row style={{ marginTop: 4, flexWrap: 'wrap' }}>
              <StatusChip
                label={net.online == null ? 'Network: checking' : net.online ? `Online${net.isWifi ? ' · Wi-Fi' : ''}` : 'Offline'}
                tone={net.online ? 'info' : 'neutral'}
                icon={net.online ? 'wifi' : 'wifi-off'}
              />
            </Row>
          </View>
        </Row>
        {!offlineReady && !checking ? (
          <Button label="Set up offline models" kind="secondary" icon="download" compact onPress={() => go('/model-setup')} style={{ marginTop: spacing.md }} />
        ) : null}
      </Card>

      <Button
        label={activeMeeting ? 'Return to meeting' : 'Start Meeting'}
        icon="mic"
        onPress={() => go(activeMeeting ? '/meeting/live' : '/meeting/mode')}
        style={{ marginTop: spacing.lg }}
      />

      {!activeMeeting ? (
        <>
          <SectionTitle>Meeting modes</SectionTitle>
          <Row style={{ alignItems: 'stretch' }}>
            <ModeTile icon="users" label="In-person" onPress={() => quickStart('physical')} />
            <ModeTile icon="phone" label="On this phone" note="Limited" onPress={() => quickStart('same_phone')} />
            <ModeTile icon="laptop" label="On laptop" onPress={() => quickStart('laptop')} />
          </Row>
        </>
      ) : null}

      <SectionTitle action={{ label: 'View all', onPress: () => go('/history') }}>Recent meetings</SectionTitle>
      {loadError ? <ErrorBanner title="Could not load meetings" message={loadError} /> : null}
      {meetings && meetings.length === 0 ? (
        <EmptyState icon="history" title="No meetings yet" message="Your transcripts are saved only on this phone and will appear here." />
      ) : null}
      {meetings?.map((m) => (
        <Card key={m.id} onPress={() => go(`/transcript/${m.id}`)} accessibilityLabel={`Open ${m.title}`} style={{ marginBottom: spacing.sm, paddingVertical: spacing.md }}>
          <Row style={{ gap: spacing.md }}>
            <Icon name="file" color={colors.primary} />
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="bodyStrong" numberOfLines={1}>{m.title}</AppText>
              <AppText variant="caption" color={colors.textMuted}>
                {formatDateTime(m.startedAt)} · {formatDuration(m.durationMs)} · {m.segmentCount} caption{m.segmentCount === 1 ? '' : 's'}
              </AppText>
              {m.status === 'interrupted' ? <StatusChip label="Interrupted" tone="warning" /> : m.status === 'active' || m.status === 'paused' ? <StatusChip label="In progress" tone="info" /> : null}
            </View>
            <Icon name="chevron-right" color={colors.textMuted} size={18} />
          </Row>
        </Card>
      ))}

      <SectionTitle>Tools</SectionTitle>
      <Row>
        <ModeTile icon="search" label="Search" onPress={() => go('/search')} />
        <ModeTile icon="cpu" label="Models" onPress={() => go('/models')} />
        <ModeTile icon="activity" label="Diagnostics" onPress={() => go('/diagnostics')} />
      </Row>
    </Screen>
  );
}

function ModeTile({ icon, label, note, onPress }: { icon: IconName; label: string; note?: string; onPress: () => void }) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={note ? `${label}, ${note} support` : label}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: TOUCH * 2,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.lg,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.sm,
        gap: 6,
        opacity: pressed ? 0.8 : 1,
      })}>
      <Icon name={icon} color={colors.primary} size={24} />
      <AppText variant="label" style={{ textAlign: 'center' }}>{label}</AppText>
      {note ? <AppText variant="label" color={colors.warning}>{note}</AppText> : null}
    </Pressable>
  );
}
