import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, ScrollView, View } from 'react-native';

import { AppHeader, AppText, EmptyState, ErrorBanner, HighlightText, LoadingState, Row, TranscriptSearchBar } from '@/components';
import { getDb, getMigrationReport } from '@/database/db';
import { listMeetings } from '@/database/repositories/meetings';
import { searchTranscript } from '@/database/repositories/search';
import { useDebounced } from '@/hooks/useDebounced';
import { radius, spacing, useAppTheme } from '@/theme';
import type { MeetingListItem, SearchHit } from '@/types';
import { formatClock, formatDate } from '@/utils/format';

type Range = 'any' | 'today' | '7d' | '30d';

function rangeStart(r: Range): number | undefined {
  const now = new Date();
  if (r === 'today') return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (r === '7d') return Date.now() - 7 * 86_400_000;
  if (r === '30d') return Date.now() - 30 * 86_400_000;
  return undefined;
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      style={{ minHeight: 36, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.infoSurface : colors.surface, justifyContent: 'center' }}>
      <AppText variant="label" color={active ? colors.primary : colors.textMuted} numberOfLines={1}>{label}</AppText>
    </Pressable>
  );
}

/** 18 Transcript Search — English + Hinglish across all meetings. */
export default function SearchScreen() {
  const { colors } = useAppTheme();
  const [q, setQ] = useState('');
  const debounced = useDebounced(q, 300);
  const [range, setRange] = useState<Range>('any');
  const [meetingId, setMeetingId] = useState<string | null>(null);
  const [meetings, setMeetings] = useState<MeetingListItem[]>([]);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fts = getMigrationReport()?.ftsAvailable ?? false;

  useEffect(() => {
    listMeetings(getDb(), { limit: 50 })
      .then(setMeetings)
      .catch(() => setMeetings([]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const term = debounced.trim();
    if (!term) {
      setHits([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    searchTranscript(getDb(), term, { meetingId: meetingId ?? undefined, fromMs: rangeStart(range), useFts: fts })
      .then((r) => {
        if (!cancelled) {
          setHits(r);
          setError(null);
        }
      })
      .catch((e) => !cancelled && setError((e as Error).message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [debounced, range, meetingId, fts]);

  const header = (
    <View style={{ gap: spacing.sm, marginBottom: spacing.md }}>
      <TranscriptSearchBar value={q} onChangeText={setQ} placeholder="Search English or Hinglish" autoFocus />
      <AppText variant="caption" color={colors.textMuted}>
        {fts ? 'Full-text index (word prefixes match)' : 'Basic search (full-text index unavailable on this build)'}
      </AppText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
        {(
          [
            ['any', 'Any time'],
            ['today', 'Today'],
            ['7d', 'Last 7 days'],
            ['30d', 'Last 30 days'],
          ] as [Range, string][]
        ).map(([v, l]) => (
          <Chip key={v} label={l} active={range === v} onPress={() => setRange(v)} />
        ))}
      </ScrollView>
      {meetings.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
          <Chip label="All meetings" active={meetingId == null} onPress={() => setMeetingId(null)} />
          {meetings.map((m) => (
            <Chip key={m.id} label={m.title.length > 24 ? m.title.slice(0, 23) + '…' : m.title} active={meetingId === m.id} onPress={() => setMeetingId(m.id)} />
          ))}
        </ScrollView>
      ) : null}
      {error ? <ErrorBanner title="Search failed" message={error} /> : null}
      {debounced.trim() && !loading && hits.length ? (
        <AppText variant="caption" color={colors.textMuted}>{hits.length}{hits.length >= 200 ? '+' : ''} result{hits.length === 1 ? '' : 's'}</AppText>
      ) : null}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AppHeader title="Search transcripts" />
      <FlatList
        data={debounced.trim() && !loading ? hits : []}
        keyExtractor={(h) => h.segmentId}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={header}
        contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.sm, maxWidth: 760, width: '100%', alignSelf: 'center' }}
        ListEmptyComponent={
          !debounced.trim() ? (
            <EmptyState icon="search" title="Search your meetings" message="Find words in the English captions or the Hinglish translation, including your corrections." />
          ) : loading ? (
            <LoadingState label="Searching…" />
          ) : error ? undefined : (
            <EmptyState icon="search" title="No results" message={`Nothing matched “${debounced.trim()}”. Try fewer words or a wider date range.`} />
          )
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push({ pathname: '/transcript/[id]', params: { id: item.meetingId, segment: item.segmentId } } as never)}
            accessibilityRole="button"
            accessibilityLabel={`${item.meetingTitle} at ${formatClock(item.startMs)}: ${item.englishText}`}
            style={({ pressed }) => ({ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm, gap: 4, opacity: pressed ? 0.85 : 1 })}>
            <Row style={{ justifyContent: 'space-between' }}>
              <AppText variant="bodyStrong" numberOfLines={1} style={{ flex: 1 }}>{item.meetingTitle}</AppText>
              <AppText variant="caption" color={colors.textMuted}>
                {formatDate(item.meetingStartedAt)} · {formatClock(item.startMs)}
              </AppText>
            </Row>
            <HighlightText text={item.englishText} query={debounced} style={{ fontSize: 15, lineHeight: 21, color: colors.text }} />
            {item.hinglishText ? (
              <HighlightText text={item.hinglishText} query={debounced} style={{ fontSize: 15, lineHeight: 21, color: colors.hinglish, fontWeight: '600' }} />
            ) : null}
          </Pressable>
        )}
      />
    </View>
  );
}
