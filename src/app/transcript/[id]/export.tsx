import { useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { isNativeAvailable, MeetLingoNative } from '@/../modules/meetlingo-native';
import {
  AppHeader,
  AppText,
  Button,
  Card,
  ConfirmDialog,
  ErrorBanner,
  LoadingState,
  RadioList,
  Row,
  Screen,
  SectionTitle,
  Segmented,
  ToggleRow,
} from '@/components';
import { getDb } from '@/database/db';
import { getMeeting } from '@/database/repositories/meetings';
import { listSegments } from '@/database/repositories/segments';
import { exportMeeting, type ExportFormat, type ExportTarget } from '@/features/export/exportService';
import type { ExportContent } from '@/features/export/formatters';
import { spacing, useAppTheme } from '@/theme';
import type { Meeting } from '@/types';
import { formatBytes, formatDateTime, formatDuration } from '@/utils/format';

/** 21 Export & Share. */
export default function ExportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useAppTheme();
  const [meeting, setMeeting] = useState<Meeting | null | undefined>(undefined);
  const [segmentCount, setSegmentCount] = useState(0);
  const [format, setFormat] = useState<ExportFormat>('txt');
  const [content, setContent] = useState<ExportContent>('both');
  const [layout, setLayout] = useState<'columns' | 'stacked'>('columns');
  const [privacyNote, setPrivacyNote] = useState(true);
  const [busy, setBusy] = useState<ExportTarget | 'audio' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [recording, setRecording] = useState<{ uri: string; sizeBytes: number } | null>(null);
  const [confirmAudio, setConfirmAudio] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const db = getDb();
        const m = await getMeeting(db, id);
        setMeeting(m);
        setSegmentCount((await listSegments(db, id)).length);
        if (isNativeAvailable) {
          try {
            setRecording(MeetLingoNative.getRecordingPath(id));
          } catch {
            setRecording(null);
          }
        }
      } catch (e) {
        setError((e as Error).message);
        setMeeting(null);
      }
    })();
  }, [id]);

  const run = async (target: ExportTarget) => {
    if (!id) return;
    setBusy(target);
    setError(null);
    setDone(null);
    try {
      const r = await exportMeeting({ meetingId: id, format, content, layout, includePrivacyNote: privacyNote, target });
      setDone(target === 'save' ? `Saved ${r.fileName} to the selected folder.` : `${r.fileName} ready — choose an app in the share sheet.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const shareAudio = async () => {
    setConfirmAudio(false);
    if (!recording) return;
    setBusy('audio');
    try {
      if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
      await Sharing.shareAsync(recording.uri, { mimeType: 'audio/wav', dialogTitle: 'Share meeting audio' });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  if (meeting === undefined) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <AppHeader title="Export & share" />
        <LoadingState />
      </View>
    );
  }

  const end = meeting ? meeting.endedAt ?? meeting.updatedAt : 0;
  const noCaptions = segmentCount === 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AppHeader title="Export & share" subtitle={meeting?.title} />
      <Screen
        footer={
          <Row>
            <Button label="Share…" icon="share" style={{ flex: 1 }} onPress={() => void run('share')} loading={busy === 'share'} disabled={!meeting || noCaptions || !!busy} />
            <Button label="Save to device…" icon="save" kind="secondary" style={{ flex: 1 }} onPress={() => void run('save')} loading={busy === 'save'} disabled={!meeting || noCaptions || !!busy} />
          </Row>
        }>
        {!meeting ? <ErrorBanner title="Meeting not found" message={error ?? undefined} /> : null}
        {meeting && noCaptions ? <ErrorBanner tone="warning" title="Nothing to export" message="This meeting has no saved captions." /> : null}
        {error && meeting ? <ErrorBanner title="Export failed" message={error} onDismiss={() => setError(null)} /> : null}
        {done ? <ErrorBanner tone="success" title={done} onDismiss={() => setDone(null)} /> : null}

        {meeting ? (
          <Card style={{ gap: 4 }}>
            <AppText variant="bodyStrong">{meeting.title}</AppText>
            <AppText variant="caption" color={colors.textMuted}>
              {formatDateTime(meeting.startedAt)} · {formatDuration(end - meeting.startedAt)} · {segmentCount} captions
            </AppText>
          </Card>
        ) : null}

        <SectionTitle>Format</SectionTitle>
        <RadioList<ExportFormat>
          value={format}
          onChange={setFormat}
          options={[
            { value: 'txt', label: 'Text (.txt)', description: 'Timestamped transcript with English and Hinglish lines.' },
            { value: 'srt', label: 'Subtitles (.srt)', description: 'Timed captions for video players. “Both” gives two-line subtitles.' },
            { value: 'pdf', label: 'PDF document', description: 'Formatted transcript with meeting details, ready to print or send.' },
          ]}
        />

        <SectionTitle>Content</SectionTitle>
        <Segmented<ExportContent>
          accessibilityLabel="Export content"
          value={content}
          onChange={setContent}
          options={[
            { value: 'both', label: 'Both' },
            { value: 'english', label: 'English' },
            { value: 'hinglish', label: 'Hinglish' },
          ]}
        />
        {content !== 'english' ? (
          <AppText variant="caption" color={colors.textMuted} style={{ marginTop: spacing.sm }}>
            Your Hinglish corrections are used where you made them. Captions without a translation are marked as unavailable.
          </AppText>
        ) : null}

        {format === 'pdf' && content === 'both' ? (
          <>
            <SectionTitle>PDF layout</SectionTitle>
            <Segmented<'columns' | 'stacked'>
              accessibilityLabel="PDF layout"
              value={layout}
              onChange={setLayout}
              options={[
                { value: 'columns', label: 'Two-column' },
                { value: 'stacked', label: 'Stacked' },
              ]}
            />
          </>
        ) : null}

        {format !== 'srt' ? (
          <View style={{ marginTop: spacing.md }}>
            <ToggleRow title="Include privacy note" subtitle="Adds a short notice that this is a machine transcript of a private meeting." value={privacyNote} onChange={setPrivacyNote} icon="shield" />
          </View>
        ) : null}

        <ErrorBanner
          tone="warning"
          title="Exported files leave MeetLingo’s private storage"
          message="Once shared or saved to a folder, other apps and people can read the file. Only share transcripts with people allowed to see the meeting."
        />

        {recording ? (
          <>
            <SectionTitle>Audio recording</SectionTitle>
            <Card style={{ gap: spacing.sm }}>
              <AppText variant="caption" color={colors.textMuted}>
                You chose to save audio for this meeting. WAV file, {formatBytes(recording.sizeBytes)}. Audio contains everyone’s voices — share only with consent.
              </AppText>
              <Button label="Share audio (.wav)…" icon="speaker" kind="secondary" loading={busy === 'audio'} disabled={!!busy} onPress={() => setConfirmAudio(true)} />
            </Card>
          </>
        ) : null}
      </Screen>

      <ConfirmDialog
        visible={confirmAudio}
        title="Share raw meeting audio?"
        message="This sends the full voice recording to the app you choose. Make sure everyone in the meeting agreed to the recording being shared."
        confirmLabel="Share audio"
        onCancel={() => setConfirmAudio(false)}
        onConfirm={() => void shareAudio()}
      />
    </View>
  );
}
