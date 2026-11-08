import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, SectionList, View } from 'react-native';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import { SafeAreaView } from 'react-native-safe-area-context';

import { isNativeAvailable, MeetLingoNative } from '@/../modules/meetlingo-native';
import {
  AppText,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorBanner,
  Field,
  Icon,
  IconButton,
  LoadingState,
  Row,
  Segmented,
  StatusChip,
  TranscriptSearchBar,
} from '@/components';
import { getDb } from '@/database/db';
import { deleteMeeting, listMeetings, renameMeeting, type MeetingSort } from '@/database/repositories/meetings';
import { useDebounced } from '@/hooks/useDebounced';
import { useSessionStore } from '@/stores/sessionStore';
import { radius, spacing, TOUCH, useAppTheme } from '@/theme';
import type { MeetingListItem, MeetingMode } from '@/types';
import { formatDate, formatDateTime, formatDuration } from '@/utils/format';

const MODE_LABEL: Record<MeetingMode, string> = {
  physical: 'In-person',
  laptop: 'Laptop meeting',
  same_phone: 'Same phone',
};

type ModeFilter = MeetingMode | 'all';

/** 16 Meeting History — SQLite-sourced, grouped by date. */
export default function HistoryScreen() {
  const { colors } = useAppTheme();
  const activeId = useSessionStore((s) => s.meeting?.id ?? null);
  const [query, setQuery] = useState('');
  const debounced = useDebounced(query, 250);
  const [sort, setSort] = useState<MeetingSort>('newest');
  const [mode, setMode] = useState<ModeFilter>('all');
  const [items, setItems] = useState<MeetingListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<MeetingListItem | null>(null);
  const [renameFor, setRenameFor] = useState<MeetingListItem | null>(null);
  const [renameText, setRenameText] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const [deleteFor, setDeleteFor] = useState<MeetingListItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const rows = await listMeetings(getDb(), { query: debounced, mode, sort });
      setItems(rows);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [debounced, mode, sort]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const sections = useMemo(() => {
    if (!items) return [];
    if (sort === 'longest' || sort === 'title') return items.length ? [{ title: sort === 'longest' ? 'Longest first' : 'A–Z', data: items }] : [];
    const map = new Map<string, MeetingListItem[]>();
    for (const m of items) {
      const k = formatDate(m.startedAt);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(m);
    }
    return [...map.entries()].map(([title, data]) => ({ title, data }));
  }, [items, sort]);

  const guardActive = (m: MeetingListItem) => {
    if (m.id === activeId) {
      setNotice('This meeting is still running. Stop it before renaming or deleting.');
      return false;
    }
    return true;
  };

  const openRename = (m: MeetingListItem) => {
    setMenuFor(null);
    if (!guardActive(m)) return;
    setRenameText(m.title);
    setRenameError(null);
    setRenameFor(m);
  };

  const openDelete = (m: MeetingListItem) => {
    setMenuFor(null);
    if (!guardActive(m)) return;
    setDeleteFor(m);
  };

  const doRename = async () => {
    if (!renameFor) return;
    if (!renameText.trim()) {
      setRenameError('Title cannot be empty.');
      return;
    }
    setBusy(true);
    try {
      await renameMeeting(getDb(), renameFor.id, renameText);
      setRenameFor(null);
      await load();
    } catch (e) {
      setRenameError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    if (!deleteFor) return;
    setBusy(true);
    try {
      await deleteMeeting(getDb(), deleteFor.id);
      if (isNativeAvailable) {
        try {
          MeetLingoNative.deleteRecording(deleteFor.id);
        } catch {
          /* no recording */
        }
      }
      setDeleteFor(null);
      await load();
    } catch (e) {
      setNotice(`Could not delete: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const modeChips: { value: ModeFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'physical', label: 'In-person' },
    { value: 'laptop', label: 'Laptop' },
    { value: 'same_phone', label: 'Same phone' },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'left', 'right']}>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.sm, maxWidth: 760, width: '100%', alignSelf: 'center' }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <AppText variant="title" accessibilityRole="header">Meeting History</AppText>
          <IconButton icon="search" label="Search all transcripts" onPress={() => router.push('/search' as never)} />
        </Row>
        <TranscriptSearchBar value={query} onChangeText={setQuery} placeholder="Search meeting titles" />
        <Segmented<MeetingSort>
          accessibilityLabel="Sort meetings"
          value={sort}
          onChange={setSort}
          options={[
            { value: 'newest', label: 'Newest' },
            { value: 'oldest', label: 'Oldest' },
            { value: 'longest', label: 'Longest' },
            { value: 'title', label: 'Title' },
          ]}
        />
        <Row style={{ flexWrap: 'wrap' }}>
          {modeChips.map((c) => {
            const active = mode === c.value;
            return (
              <Pressable
                key={c.value}
                onPress={() => setMode(c.value)}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                style={{ minHeight: 36, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.infoSurface : colors.surface, justifyContent: 'center' }}>
                <AppText variant="label" color={active ? colors.primary : colors.textMuted}>{c.label}</AppText>
              </Pressable>
            );
          })}
        </Row>
        {error ? <ErrorBanner title="Could not load history" message={error} action={{ label: 'Retry', onPress: () => void load() }} /> : null}
        {notice ? <ErrorBanner title={notice} tone="warning" onDismiss={() => setNotice(null)} /> : null}
      </View>

      {items == null && !error ? (
        <LoadingState label="Loading meetings…" />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.sm, maxWidth: 760, width: '100%', alignSelf: 'center' }}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <AppText variant="label" color={colors.textMuted} style={{ marginTop: spacing.md, marginBottom: spacing.sm }}>
              {section.title.toUpperCase()}
            </AppText>
          )}
          renderItem={({ item }) => (
            <MeetingRow
              item={item}
              active={item.id === activeId}
              onOpen={() => router.push({ pathname: '/transcript/[id]', params: { id: item.id } } as never)}
              onMore={() => setMenuFor(item)}
              onRename={() => openRename(item)}
              onDelete={() => openDelete(item)}
            />
          )}
          ListEmptyComponent={
            debounced || mode !== 'all' ? (
              <EmptyState icon="search" title="No matching meetings" message="Try a different title or filter." />
            ) : (
              <EmptyState
                icon="history"
                title="No meetings yet"
                message="Meetings you capture are saved only on this phone and appear here."
                action={{ label: 'Start a meeting', onPress: () => router.push('/meeting/mode' as never) }}
              />
            )
          }
        />
      )}

      <ConfirmDialog
        visible={!!menuFor}
        title={menuFor?.title ?? ''}
        message="Choose an action for this meeting."
        confirmLabel="Open"
        cancelLabel="Close"
        onCancel={() => setMenuFor(null)}
        onConfirm={() => {
          const m = menuFor;
          setMenuFor(null);
          if (m) router.push({ pathname: '/transcript/[id]', params: { id: m.id } } as never);
        }}>
        <View style={{ gap: spacing.sm }}>
          <Button label="Rename" kind="secondary" icon="edit" onPress={() => menuFor && openRename(menuFor)} />
          <Button label="Delete" kind="secondary" icon="trash" onPress={() => menuFor && openDelete(menuFor)} />
        </View>
      </ConfirmDialog>

      <ConfirmDialog
        visible={!!renameFor}
        title="Rename meeting"
        confirmLabel="Save"
        onCancel={() => setRenameFor(null)}
        onConfirm={() => void doRename()}
        loading={busy}>
        <Field label="Meeting title" value={renameText} onChangeText={setRenameText} error={renameError} autoFocus maxLength={120} />
      </ConfirmDialog>

      <ConfirmDialog
        visible={!!deleteFor}
        title="Delete meeting?"
        message={`"${deleteFor?.title ?? ''}" and its ${deleteFor?.segmentCount ?? 0} captions, summary, action items and any saved recording will be permanently removed from this phone.`}
        confirmLabel="Delete"
        destructive
        loading={busy}
        onCancel={() => setDeleteFor(null)}
        onConfirm={() => void doDelete()}
      />
    </SafeAreaView>
  );
}

function MeetingRow({
  item,
  active,
  onOpen,
  onMore,
  onRename,
  onDelete,
}: {
  item: MeetingListItem;
  active: boolean;
  onOpen: () => void;
  onMore: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const { colors } = useAppTheme();
  const renderRight = (_p: unknown, _t: unknown, methods: SwipeableMethods) => (
    <Row style={{ marginBottom: spacing.sm, marginLeft: spacing.sm, gap: spacing.xs }}>
      <Pressable
        onPress={() => {
          methods.close();
          onRename();
        }}
        accessibilityRole="button"
        accessibilityLabel={`Rename ${item.title}`}
        style={{ width: 76, alignSelf: 'stretch', backgroundColor: colors.primary, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', gap: 4 }}>
        <Icon name="edit" color="#FFFFFF" size={20} />
        <AppText variant="label" color="#FFFFFF">Rename</AppText>
      </Pressable>
      <Pressable
        onPress={() => {
          methods.close();
          onDelete();
        }}
        accessibilityRole="button"
        accessibilityLabel={`Delete ${item.title}`}
        style={{ width: 76, alignSelf: 'stretch', backgroundColor: colors.danger, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', gap: 4 }}>
        <Icon name="trash" color="#FFFFFF" size={20} />
        <AppText variant="label" color="#FFFFFF">Delete</AppText>
      </Pressable>
    </Row>
  );
  return (
    <ReanimatedSwipeable friction={2} rightThreshold={40} renderRightActions={renderRight} overshootRight={false}>
      <Pressable
        onPress={onOpen}
        onLongPress={onMore}
        accessibilityRole="button"
        accessibilityLabel={`${item.title}, ${formatDateTime(item.startedAt)}, ${formatDuration(item.durationMs)}, ${item.segmentCount} captions`}
        accessibilityHint="Opens the transcript. Long-press for rename and delete."
        style={({ pressed }) => ({
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          padding: spacing.md,
          marginBottom: spacing.sm,
          opacity: pressed ? 0.85 : 1,
        })}>
        <Row style={{ alignItems: 'flex-start', gap: spacing.md }}>
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.infoSurface, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={item.mode === 'laptop' ? 'laptop' : item.mode === 'same_phone' ? 'phone' : 'users'} color={colors.primary} size={20} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="bodyStrong" numberOfLines={1}>{item.title}</AppText>
            <AppText variant="caption" color={colors.textMuted}>
              {formatDateTime(item.startedAt)} · {formatDuration(item.durationMs)}
            </AppText>
            <AppText variant="caption" color={colors.textMuted}>
              {MODE_LABEL[item.mode]} · {item.segmentCount} caption{item.segmentCount === 1 ? '' : 's'}
            </AppText>
            {active ? <StatusChip label="Live now" tone="live" /> : item.status === 'interrupted' ? <StatusChip label="Interrupted" tone="warning" icon="alert" /> : null}
          </View>
          <View style={{ minWidth: TOUCH }}>
            <IconButton icon="more" label={`More actions for ${item.title}`} onPress={onMore} color={colors.textMuted} />
          </View>
        </Row>
      </Pressable>
    </ReanimatedSwipeable>
  );
}
