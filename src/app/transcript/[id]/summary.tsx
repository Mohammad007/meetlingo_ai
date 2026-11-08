import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import {
  AppHeader,
  AppText,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorBanner,
  Field,
  LoadingState,
  Row,
  Screen,
  SectionTitle,
  StatusChip,
} from '@/components';
import { getDb } from '@/database/db';
import { getMeeting } from '@/database/repositories/meetings';
import { listSegments } from '@/database/repositories/segments';
import { getSummary, saveSummary } from '@/database/repositories/summaries';
import { summarize } from '@/features/summary/extractive';
import { radius, spacing, useAppTheme } from '@/theme';
import type { MeetingSummary } from '@/types';
import { formatClock, formatDateTime } from '@/utils/format';

const MIN_CAPTIONS = 3;

/** 19 Local Meeting Summary — basic extractive, computed on-device. */
export default function SummaryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useAppTheme();
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState<MeetingSummary | null>(null);
  const [captionCount, setCaptionCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [confirmRegen, setConfirmRegen] = useState(false);
  const [busy, setBusy] = useState(false);

  const compute = useCallback(async () => {
    if (!id) return;
    const db = getDb();
    const segs = await listSegments(db, id);
    setCaptionCount(segs.length);
    if (segs.length < MIN_CAPTIONS) {
      setSummary(null);
      return;
    }
    const r = summarize(segs.map((s) => ({ segmentId: s.id, startMs: s.startMs, text: s.englishText })));
    await saveSummary(db, { meetingId: id, summaryText: r.summaryText, keyPoints: r.keyPoints, keywords: r.keywords, method: 'local_extractive' });
    setSummary(await getSummary(db, id));
  }, [id]);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const db = getDb();
      const m = await getMeeting(db, id);
      if (!m) {
        setError('Meeting not found.');
        return;
      }
      setTitle(m.title);
      const existing = await getSummary(db, id);
      if (existing) {
        setSummary(existing);
        const segs = await listSegments(db, id);
        setCaptionCount(segs.length);
      } else {
        await compute();
      }
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id, compute]);

  useEffect(() => {
    void load();
  }, [load]);

  const regenerate = async () => {
    setConfirmRegen(false);
    setBusy(true);
    try {
      await compute();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async () => {
    if (!id || !summary) return;
    setBusy(true);
    try {
      await saveSummary(getDb(), { meetingId: id, summaryText: editText.trim(), keyPoints: summary.keyPoints, keywords: summary.keywords, method: 'user_edited' });
      setSummary(await getSummary(getDb(), id));
      setEditing(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const openSegment = (segmentId: string) => router.push({ pathname: '/transcript/[id]', params: { id: id!, segment: segmentId } } as never);

  const loading = captionCount === null && !error;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AppHeader title="Basic offline summary" subtitle={title} />
      <Screen>
        {error ? <ErrorBanner title="Could not build summary" message={error} /> : null}
        {loading ? <LoadingState label="Analysing captions on this phone…" /> : null}

        <Card style={{ gap: spacing.sm, backgroundColor: colors.infoSurface, borderColor: colors.infoSurface }}>
          <Row>
            <StatusChip label="Basic offline summary" tone="info" icon="cpu" />
            {summary?.method === 'user_edited' ? <StatusChip label="Edited by you" tone="neutral" icon="edit" /> : null}
          </Row>
          <AppText variant="caption">
            Extracted sentences, not AI-written. MeetLingo scores each English caption by how often its key words occur across the meeting and picks the most representative ones, verbatim, with links to where they were said. Nothing is added or rephrased.
          </AppText>
          <AppText variant="caption" color={colors.textMuted}>Generative AI refinement is not available offline in this version.</AppText>
        </Card>

        {!loading && captionCount !== null && captionCount < MIN_CAPTIONS ? (
          <EmptyState icon="list" title="Not enough to summarise" message={`Need at least ${MIN_CAPTIONS} captions. This meeting has ${captionCount}.`} />
        ) : null}

        {summary ? (
          <>
            {summary.keywords.length ? (
              <>
                <SectionTitle>Keywords</SectionTitle>
                <Row style={{ flexWrap: 'wrap' }}>
                  {summary.keywords.map((k) => (
                    <View key={k} style={{ paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt }}>
                      <AppText variant="label">{k}</AppText>
                    </View>
                  ))}
                </Row>
              </>
            ) : null}

            {summary.method === 'user_edited' ? (
              <>
                <SectionTitle>Your summary</SectionTitle>
                <Card>
                  <AppText selectable>{summary.summaryText || '(empty)'}</AppText>
                </Card>
              </>
            ) : null}

            <SectionTitle>Key points from the transcript</SectionTitle>
            {summary.keyPoints.length ? (
              summary.keyPoints.map((k) => (
                <Pressable
                  key={k.segmentId}
                  onPress={() => openSegment(k.segmentId)}
                  accessibilityRole="button"
                  accessibilityLabel={`At ${formatClock(k.startMs)}: ${k.text}. Open in transcript.`}
                  style={({ pressed }) => ({ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm, gap: 4, opacity: pressed ? 0.85 : 1 })}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <AppText variant="label" color={colors.primary}>{formatClock(k.startMs)} · View in transcript ›</AppText>
                  </Row>
                  <AppText selectable>{k.text}</AppText>
                </Pressable>
              ))
            ) : (
              <AppText color={colors.textMuted}>No distinctive sentences found.</AppText>
            )}
            <AppText variant="caption" color={colors.textMuted} style={{ marginTop: spacing.sm }}>
              Updated {formatDateTime(summary.updatedAt)}
            </AppText>

            <Row style={{ marginTop: spacing.lg, flexWrap: 'wrap' }}>
              <Button
                label="Edit"
                kind="secondary"
                icon="edit"
                onPress={() => {
                  setEditText(summary.summaryText);
                  setEditing(true);
                }}
              />
              <Button
                label="Regenerate"
                kind="secondary"
                icon="refresh"
                loading={busy}
                onPress={() => (summary.method === 'user_edited' ? setConfirmRegen(true) : void regenerate())}
              />
            </Row>
          </>
        ) : null}
      </Screen>

      <ConfirmDialog visible={editing} title="Edit summary" confirmLabel="Save" loading={busy} onCancel={() => setEditing(false)} onConfirm={() => void saveEdit()}>
        <Field label="Summary" value={editText} onChangeText={setEditText} multiline hint="Your edit is saved locally and marked as edited." />
      </ConfirmDialog>
      <ConfirmDialog
        visible={confirmRegen}
        title="Replace your edits?"
        message="Regenerating recomputes the extractive summary from the transcript and discards your edited text."
        confirmLabel="Regenerate"
        destructive
        onCancel={() => setConfirmRegen(false)}
        onConfirm={() => void regenerate()}
      />
    </View>
  );
}
