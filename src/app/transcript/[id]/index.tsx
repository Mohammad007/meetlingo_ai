import * as Clipboard from 'expo-clipboard';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, View } from 'react-native';

import { isNativeAvailable, MeetLingoNative } from '@/../modules/meetlingo-native';
import {
  AppHeader,
  AppText,
  Button,
  CaptionCard,
  ConfirmDialog,
  EmptyState,
  ErrorBanner,
  Field,
  IconButton,
  LoadingState,
  Row,
  Segmented,
  StatusChip,
  TranscriptSearchBar,
} from '@/components';
import { getDb } from '@/database/db';
import { getMeeting } from '@/database/repositories/meetings';
import { displayHinglish, listSegments, saveCorrection } from '@/database/repositories/segments';
import { useDebounced } from '@/hooks/useDebounced';
import { retryAllTranslations, retryTranslation } from '@/services/meetingSession';
import { useModelStore } from '@/stores/modelStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { spacing, useAppTheme } from '@/theme';
import type { Meeting, OutputMode, TranscriptSegment, TranslationStyle } from '@/types';
import { formatBytes, formatClock, formatDateTime, formatDuration } from '@/utils/format';

const MODE_LABEL: Record<Meeting['mode'], string> = {
  physical: 'In-person · phone microphone',
  laptop: 'Laptop speakers → phone microphone',
  same_phone: 'Same phone · permitted playback',
};

/** 17 Transcript Detail. */
export default function TranscriptDetailScreen() {
  const { id, segment } = useLocalSearchParams<{ id: string; segment?: string }>();
  const { colors } = useAppTheme();
  const settings = useSettingsStore((s) => s.settings);
  const hindiReady = useModelStore((s) => !!s.translation?.downloaded);
  const [meeting, setMeeting] = useState<Meeting | null | undefined>(undefined);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [display, setDisplay] = useState<OutputMode>(settings.outputMode);
  const [query, setQuery] = useState('');
  const debounced = useDebounced(query, 200);
  const [matchIdx, setMatchIdx] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [editing, setEditing] = useState<TranscriptSegment | null>(null);
  const [editText, setEditText] = useState('');
  const [busy, setBusy] = useState(false);
  const [translatingAll, setTranslatingAll] = useState(false);
  const [recording, setRecording] = useState<{ sizeBytes: number } | null>(null);
  const [confirmDeleteRec, setConfirmDeleteRec] = useState(false);
  const listRef = useRef<FlatList<TranscriptSegment>>(null);
  const deepLinked = useRef(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const db = getDb();
      const [m, segs] = await Promise.all([getMeeting(db, id), listSegments(db, id)]);
      setMeeting(m);
      setSegments(segs);
      setError(null);
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
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const scrollTo = useCallback((index: number) => {
    if (index < 0) return;
    listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.2 });
  }, []);

  // Deep link: ?segment=<id>
  useEffect(() => {
    if (deepLinked.current || !segment || !segments.length) return;
    const idx = segments.findIndex((s) => s.id === segment);
    if (idx >= 0) {
      deepLinked.current = true;
      setTimeout(() => scrollTo(idx), 300);
    }
  }, [segment, segments, scrollTo]);

  const matches = useMemo(() => {
    const q = debounced.trim().toLowerCase();
    if (!q) return [] as number[];
    return segments
      .map((s, i) => ({ i, t: `${s.englishText} ${displayHinglish(s) ?? ''}`.toLowerCase() }))
      .filter((x) => x.t.includes(q))
      .map((x) => x.i);
  }, [debounced, segments]);

  useEffect(() => {
    setMatchIdx(0);
    if (matches.length) scrollTo(matches[0]);
  }, [matches, scrollTo]);

  const step = (d: number) => {
    if (!matches.length) return;
    const next = (matchIdx + d + matches.length) % matches.length;
    setMatchIdx(next);
    scrollTo(matches[next]);
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((t) => (t === msg ? null : t)), 2200);
  };

  const copySegment = async (s: TranscriptSegment) => {
    const h = displayHinglish(s);
    await Clipboard.setStringAsync([`[${formatClock(s.startMs)}] ${s.englishText}`, h].filter(Boolean).join('\n'));
    showToast('Caption copied');
  };

  const openEdit = (s: TranscriptSegment) => {
    setEditText(displayHinglish(s) ?? '');
    setEditing(s);
  };

  const saveEdit = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      const machine = editing.hinglishText ?? '';
      const v = editText.trim();
      await saveCorrection(getDb(), editing.id, v && v !== machine ? v : null);
      setEditing(null);
      await load();
      showToast(v && v !== machine ? 'Correction saved' : 'Reverted to machine Hinglish');
    } catch (e) {
      showToast(`Could not save: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const untranslated = segments.filter((s) => s.state !== 'translated');

  const translateAll = async () => {
    if (!id) return;
    setTranslatingAll(true);
    try {
      const n = await retryAllTranslations(id);
      await load();
      showToast(`${n} caption${n === 1 ? '' : 's'} processed`);
    } catch (e) {
      showToast((e as Error).message);
    } finally {
      setTranslatingAll(false);
    }
  };

  const retryOne = async (segId: string) => {
    try {
      await retryTranslation(segId);
    } finally {
      await load();
    }
  };

  const deleteRecording = () => {
    if (!id || !isNativeAvailable) return;
    MeetLingoNative.deleteRecording(id);
    setRecording(null);
    setConfirmDeleteRec(false);
    showToast('Recording deleted');
  };

  if (meeting === undefined) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <AppHeader title="Transcript" />
        <LoadingState label="Loading transcript…" />
      </View>
    );
  }
  if (!meeting) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <AppHeader title="Transcript" />
        <EmptyState icon="alert" title="Meeting not found" message={error ?? 'It may have been deleted.'} action={{ label: 'Back to history', onPress: () => router.replace('/history' as never) }} />
      </View>
    );
  }

  const translationStyle: TranslationStyle = settings.translationStyle === 'english' ? 'natural_hinglish' : settings.translationStyle;
  const end = meeting.endedAt ?? meeting.updatedAt;
  const currentMatch = matches[matchIdx];

  const header = (
    <View style={{ gap: spacing.sm, marginBottom: spacing.md }}>
      <AppText variant="caption" color={colors.textMuted}>
        {formatDateTime(meeting.startedAt)} · {formatDuration(end - meeting.startedAt)} · {MODE_LABEL[meeting.mode]}
      </AppText>
      <Row style={{ flexWrap: 'wrap' }}>
        <StatusChip label={`${segments.length} captions`} tone="neutral" />
        {meeting.status === 'interrupted' ? <StatusChip label="Interrupted" tone="warning" icon="alert" /> : null}
        {meeting.status === 'active' || meeting.status === 'paused' ? <StatusChip label="In progress" tone="live" /> : null}
      </Row>
      {meeting.status === 'interrupted' ? (
        <ErrorBanner tone="warning" title="Capture stopped when the app was closed" message="Captions were saved up to that point. Nothing was recorded after the app stopped." />
      ) : null}
      <Row style={{ flexWrap: 'wrap' }}>
        <Button compact kind="secondary" icon="list" label="Summary" onPress={() => router.push({ pathname: '/transcript/[id]/summary', params: { id: meeting.id } } as never)} />
        <Button compact kind="secondary" icon="check-circle" label="Action items" onPress={() => router.push({ pathname: '/transcript/[id]/actions', params: { id: meeting.id } } as never)} />
        <Button compact kind="secondary" icon="share" label="Export" onPress={() => router.push({ pathname: '/transcript/[id]/export', params: { id: meeting.id } } as never)} />
      </Row>
      {untranslated.length > 0 && settings.translationStyle !== 'english' ? (
        hindiReady ? (
          <ErrorBanner
            tone="info"
            title={`${untranslated.length} caption${untranslated.length === 1 ? '' : 's'} without Hinglish`}
            message="They were saved in English (translation failed, was skipped, or the app closed). Translate them now on-device."
            action={{ label: translatingAll ? 'Translating…' : `Translate pending (${untranslated.length})`, onPress: () => !translatingAll && void translateAll() }}
          />
        ) : (
          <ErrorBanner
            tone="warning"
            title={`${untranslated.length} caption${untranslated.length === 1 ? '' : 's'} without Hinglish`}
            message="The Hindi translation model is not installed, so these can't be translated yet."
            action={{ label: 'Open Model Manager', onPress: () => router.push('/models' as never) }}
          />
        )
      ) : null}
      {recording ? (
        <Row style={{ justifyContent: 'space-between', padding: spacing.md, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
          <View style={{ flex: 1 }}>
            <AppText variant="bodyStrong">Audio recording saved</AppText>
            <AppText variant="caption" color={colors.textMuted}>{formatBytes(recording.sizeBytes)} · stored privately on this phone (you opted in)</AppText>
          </View>
          <Button compact kind="ghost" icon="trash" label="Delete" onPress={() => setConfirmDeleteRec(true)} />
        </Row>
      ) : null}
      <Segmented<OutputMode>
        accessibilityLabel="Display language"
        value={display}
        onChange={setDisplay}
        options={[
          { value: 'dual', label: 'Both' },
          { value: 'english', label: 'English' },
          { value: 'hinglish', label: 'Hinglish' },
        ]}
      />
      <TranscriptSearchBar value={query} onChangeText={setQuery} placeholder="Find in this transcript" />
      {debounced.trim() ? (
        <Row style={{ justifyContent: 'space-between' }}>
          <AppText variant="caption" color={colors.textMuted}>
            {matches.length ? `Match ${matchIdx + 1} of ${matches.length}` : 'No matches'}
          </AppText>
          <Row>
            <IconButton icon="chevron-left" label="Previous match" onPress={() => step(-1)} disabled={!matches.length} />
            <IconButton icon="chevron-right" label="Next match" onPress={() => step(1)} disabled={!matches.length} />
          </Row>
        </Row>
      ) : null}
      <AppText variant="caption" color={colors.textMuted}>Tap a caption to copy it. Long-press (or the edit button) to correct the Hinglish.</AppText>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AppHeader title={meeting.title} subtitle="Transcript" />
      {toast ? (
        <View style={{ position: 'absolute', bottom: 24, left: 16, right: 16, zIndex: 10 }} pointerEvents="none">
          <View style={{ backgroundColor: '#102846', borderRadius: 12, padding: spacing.md, alignSelf: 'center' }} accessibilityLiveRegion="polite">
            <AppText color="#FFFFFF" variant="bodyStrong">{toast}</AppText>
          </View>
        </View>
      ) : null}
      <FlatList
        ref={listRef}
        data={segments}
        keyExtractor={(s) => s.id}
        ListHeaderComponent={header}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 96, maxWidth: 760, width: '100%', alignSelf: 'center' }}
        onScrollToIndexFailed={(info) => {
          listRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: true });
          setTimeout(() => listRef.current?.scrollToIndex({ index: info.index, animated: true, viewPosition: 0.2 }), 250);
        }}
        ListEmptyComponent={
          <EmptyState icon="file" title="No captions saved" message="Nothing was recognised in this meeting, or transcript saving was turned off." />
        }
        renderItem={({ item, index }) => (
          <View style={currentMatch === index || item.id === segment ? { borderLeftWidth: 3, borderLeftColor: colors.primary, paddingLeft: 6 } : undefined}>
            <CaptionCard
              startMs={item.startMs}
              englishText={item.englishText}
              hinglishText={displayHinglish(item)}
              hindiText={item.hindiText}
              state={item.state}
              outputMode={display}
              translationStyle={translationStyle}
              fontSize={settings.captionFontSize}
              corrected={!!item.correctedHinglish}
              highlight={debounced}
              onPress={() => void copySegment(item)}
              onLongPress={() => openEdit(item)}
              onRetry={hindiReady ? () => void retryOne(item.id) : undefined}
              footer={
                display !== 'english' && item.state === 'translated' ? (
                  <Row style={{ justifyContent: 'flex-end' }}>
                    <Button compact kind="ghost" icon="edit" label="Edit Hinglish" onPress={() => openEdit(item)} />
                  </Row>
                ) : null
              }
            />
          </View>
        )}
      />

      <ConfirmDialog
        visible={!!editing}
        title="Correct Hinglish"
        message={editing ? `English: “${editing.englishText}”` : undefined}
        confirmLabel="Save"
        loading={busy}
        onCancel={() => setEditing(null)}
        onConfirm={() => void saveEdit()}>
        <Field
          label="Hinglish"
          value={editText}
          onChangeText={setEditText}
          multiline
          hint={editing?.hinglishText ? `Machine version: ${editing.hinglishText}. Leave empty to revert.` : 'Leave empty to keep the machine translation.'}
        />
      </ConfirmDialog>

      <ConfirmDialog
        visible={confirmDeleteRec}
        title="Delete audio recording?"
        message="The saved WAV file for this meeting will be permanently removed. The transcript is kept."
        confirmLabel="Delete"
        destructive
        onCancel={() => setConfirmDeleteRec(false)}
        onConfirm={deleteRecording}
      />
    </View>
  );
}
