import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
  Icon,
  IconButton,
  LoadingState,
  Row,
  Screen,
  StatusChip,
} from '@/components';
import { getDb } from '@/database/db';
import {
  addSuggestions,
  deleteActionItem,
  listActionItems,
  saveActionItem,
  setActionComplete,
} from '@/database/repositories/actionItems';
import { listSegments } from '@/database/repositories/segments';
import { suggestActionItems } from '@/features/meetings/actionItems';
import { spacing, useAppTheme } from '@/theme';
import type { ActionItem, TranscriptSegment } from '@/types';
import { formatClock, formatDate } from '@/utils/format';

interface Draft {
  id?: string;
  taskText: string;
  assignee: string;
  due: string; // YYYY-MM-DD or ''
  isSuggestion: boolean;
  isComplete: boolean;
}

const toIsoDate = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Parses YYYY-MM-DD into local-midnight epoch ms; returns undefined for invalid input, null for empty. */
function parseDue(s: string): number | null | undefined {
  const t = s.trim();
  if (!t) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (!m) return undefined;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (d.getFullYear() !== Number(m[1]) || d.getMonth() !== Number(m[2]) - 1 || d.getDate() !== Number(m[3])) return undefined;
  return d.getTime();
}

const startOfToday = () => {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
};

/** 20 Action Items. */
export default function ActionItemsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useAppTheme();
  const [items, setItems] = useState<ActionItem[] | null>(null);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const db = getDb();
      const [a, s] = await Promise.all([listActionItems(db, id), listSegments(db, id)]);
      setItems(a);
      setSegments(s);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const segById = useMemo(() => new Map(segments.map((s) => [s.id, s])), [segments]);

  const findSuggestions = async () => {
    if (!id) return;
    setBusy(true);
    try {
      const sugg = suggestActionItems(segments.map((s) => ({ segmentId: s.id, text: s.englishText })));
      const added = await addSuggestions(getDb(), id, sugg);
      setInfo(
        added
          ? `${added} suggested task${added === 1 ? '' : 's'} added for your review.`
          : sugg.length
            ? 'No new suggestions — matching captions already have items.'
            : 'No explicit requests or commitments were found in the captions.',
      );
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const openEdit = (a?: ActionItem) => {
    setDraftError(null);
    setDraft(
      a
        ? { id: a.id, taskText: a.taskText, assignee: a.assignee ?? '', due: a.dueAt ? toIsoDate(a.dueAt) : '', isSuggestion: a.isSuggestion, isComplete: a.isComplete }
        : { taskText: '', assignee: '', due: '', isSuggestion: false, isComplete: false },
    );
  };

  const saveDraft = async () => {
    if (!draft || !id) return;
    if (!draft.taskText.trim()) {
      setDraftError('Enter the task.');
      return;
    }
    const due = parseDue(draft.due);
    if (due === undefined) {
      setDraftError('Due date must be YYYY-MM-DD (or leave empty).');
      return;
    }
    setBusy(true);
    try {
      const existing = draft.id ? items?.find((i) => i.id === draft.id) : undefined;
      await saveActionItem(getDb(), {
        id: draft.id,
        meetingId: id,
        sourceSegmentId: existing?.sourceSegmentId ?? null,
        taskText: draft.taskText,
        assignee: draft.assignee,
        dueAt: due,
        // Editing a suggestion counts as reviewing it.
        isSuggestion: false,
        isComplete: draft.isComplete,
      });
      setDraft(null);
      await load();
    } catch (e) {
      setDraftError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const accept = async (a: ActionItem) => {
    await saveActionItem(getDb(), { ...a, isSuggestion: false });
    await load();
  };

  const toggle = async (a: ActionItem) => {
    await setActionComplete(getDb(), a.id, !a.isComplete);
    await load();
  };

  const doDelete = async () => {
    if (!deleteId) return;
    await deleteActionItem(getDb(), deleteId);
    setDeleteId(null);
    await load();
  };

  const openSource = (segmentId: string) => router.push({ pathname: '/transcript/[id]', params: { id: id!, segment: segmentId } } as never);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AppHeader title="Action items" right={<IconButton icon="plus" label="Add action item" onPress={() => openEdit()} />} />
      <Screen>
        {error ? <ErrorBanner title="Something went wrong" message={error} onDismiss={() => setError(null)} /> : null}
        {info ? <ErrorBanner tone="info" title={info} onDismiss={() => setInfo(null)} /> : null}
        <Card style={{ gap: spacing.sm, marginBottom: spacing.md }}>
          <AppText variant="caption" color={colors.textMuted}>
            Suggestions come only from captions with explicit requests or commitments (for example “I will…”, “Can you…”, “Please…”, “Let’s…”). MeetLingo never guesses who is responsible or when it is due — add those yourself.
          </AppText>
          <Row style={{ flexWrap: 'wrap' }}>
            <Button label="Find suggested tasks" icon="sparkle" kind="secondary" compact loading={busy} disabled={!segments.length} onPress={() => void findSuggestions()} />
            <Button label="Add item" icon="plus" compact onPress={() => openEdit()} />
          </Row>
        </Card>

        {items == null && !error ? <LoadingState /> : null}
        {items && !items.length ? (
          <EmptyState icon="check-circle" title="No action items yet" message={segments.length ? 'Find suggested tasks from the transcript or add one manually.' : 'This meeting has no captions to analyse. You can still add items manually.'} />
        ) : null}

        {items?.map((a) => {
          const src = a.sourceSegmentId ? segById.get(a.sourceSegmentId) : undefined;
          return (
            <Card key={a.id} style={{ marginBottom: spacing.sm, gap: spacing.sm, borderColor: a.isSuggestion ? colors.warning : colors.border, borderStyle: a.isSuggestion ? 'dashed' : 'solid' }}>
              <Row style={{ alignItems: 'flex-start', gap: spacing.md }}>
                <Pressable
                  onPress={() => void toggle(a)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: a.isComplete }}
                  accessibilityLabel={a.taskText}
                  hitSlop={10}
                  style={{ minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center', marginLeft: -8, marginTop: -8 }}>
                  <Icon name={a.isComplete ? 'checkbox-on' : 'checkbox'} color={a.isComplete ? colors.success : colors.textMuted} size={24} />
                </Pressable>
                <View style={{ flex: 1, gap: 4 }}>
                  {a.isSuggestion ? <StatusChip label="Review suggested task" tone="warning" /> : null}
                  <AppText variant="bodyStrong" style={a.isComplete ? { textDecorationLine: 'line-through', opacity: 0.6 } : undefined}>{a.taskText}</AppText>
                  {a.assignee || a.dueAt ? (
                    <Row style={{ flexWrap: 'wrap' }}>
                      {a.assignee ? <StatusChip label={a.assignee} tone="neutral" icon="user" /> : null}
                      {a.dueAt ? <StatusChip label={`Due ${formatDate(a.dueAt)}`} tone={!a.isComplete && a.dueAt < startOfToday() ? 'danger' : 'info'} icon="calendar" /> : null}
                    </Row>
                  ) : null}
                  {src ? (
                    <Pressable onPress={() => openSource(src.id)} accessibilityRole="link" style={{ minHeight: 32, justifyContent: 'center' }}>
                      <AppText variant="caption" color={colors.primary}>From caption at {formatClock(src.startMs)} ›</AppText>
                    </Pressable>
                  ) : null}
                </View>
              </Row>
              <Row style={{ justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                {a.isSuggestion ? <Button label="Accept" icon="check" compact kind="secondary" onPress={() => void accept(a)} /> : null}
                <Button label="Edit" icon="edit" compact kind="ghost" onPress={() => openEdit(a)} />
                <Button label="Delete" icon="trash" compact kind="ghost" onPress={() => setDeleteId(a.id)} />
              </Row>
            </Card>
          );
        })}
      </Screen>

      <ConfirmDialog visible={!!draft} title={draft?.id ? 'Edit action item' : 'Add action item'} confirmLabel="Save" loading={busy} onCancel={() => setDraft(null)} onConfirm={() => void saveDraft()}>
        {draft ? (
          <View>
            <Field label="Task" value={draft.taskText} onChangeText={(t) => setDraft({ ...draft, taskText: t })} multiline error={draftError} />
            <Field label="Assignee (optional)" value={draft.assignee} onChangeText={(t) => setDraft({ ...draft, assignee: t })} placeholder="Name" autoCapitalize="words" />
            <Field label="Due date (optional)" value={draft.due} onChangeText={(t) => setDraft({ ...draft, due: t })} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" />
            <Row style={{ flexWrap: 'wrap' }}>
              <Button compact kind="secondary" label="Today" onPress={() => setDraft({ ...draft, due: toIsoDate(startOfToday()) })} />
              <Button compact kind="secondary" label="Tomorrow" onPress={() => setDraft({ ...draft, due: toIsoDate(startOfToday() + 86_400_000) })} />
              <Button compact kind="secondary" label="Next week" onPress={() => setDraft({ ...draft, due: toIsoDate(startOfToday() + 7 * 86_400_000) })} />
              <Button compact kind="ghost" label="Clear" onPress={() => setDraft({ ...draft, due: '' })} />
            </Row>
          </View>
        ) : null}
      </ConfirmDialog>

      <ConfirmDialog visible={!!deleteId} title="Delete action item?" confirmLabel="Delete" destructive onCancel={() => setDeleteId(null)} onConfirm={() => void doDelete()} />
    </View>
  );
}
