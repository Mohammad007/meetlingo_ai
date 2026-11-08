import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Switch, View } from 'react-native';

import { isNativeAvailable, MeetLingoNative } from '@/../modules/meetlingo-native';
import {
  AppHeader,
  AppText,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorBanner,
  Field,
  IconButton,
  LoadingState,
  RadioList,
  Row,
  Screen,
  SectionTitle,
  Segmented,
  StatusChip,
  TranscriptSearchBar,
} from '@/components';
import { getDb } from '@/database/db';
import {
  DEFAULT_GLOSSARY,
  deleteGlossaryEntry,
  listGlossary,
  saveGlossaryEntry,
  setGlossaryEnabled,
  validateGlossary,
} from '@/database/repositories/glossary';
import { translateToHinglish, type HinglishResult } from '@/features/captions/hinglish/pipeline';
import { maskProtectedTerms } from '@/features/captions/hinglish/protect';
import { invalidateGlossary } from '@/features/glossary/glossaryCache';
import { useModelStore } from '@/stores/modelStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { spacing, useAppTheme } from '@/theme';
import type { GlossaryEntry, GlossaryRuleType } from '@/types';

const RULE_LABEL: Record<GlossaryRuleType, string> = {
  preserve_english: 'Keep in English',
  translate_as: 'Translate as',
  romanization_override: 'Spelling override',
};

const RULE_OPTIONS: { value: GlossaryRuleType; label: string; description: string }[] = [
  { value: 'preserve_english', label: 'Keep in English', description: 'The term stays in English in the Hinglish line (e.g. API, dashboard).' },
  { value: 'translate_as', label: 'Translate as', description: 'Replace an English phrase with your own Hinglish wording.' },
  { value: 'romanization_override', label: 'Spelling override', description: 'Fix how a Hindi word is spelled in Roman script. Source can be Devanagari or Roman.' },
];

type Filter = 'all' | GlossaryRuleType;

interface Draft {
  id?: string;
  sourcePhrase: string;
  replacement: string;
  ruleType: GlossaryRuleType;
  enabled: boolean;
}

const EMPTY_DRAFT: Draft = { sourcePhrase: '', replacement: '', ruleType: 'preserve_english', enabled: true };

export default function GlossaryScreen() {
  const { colors } = useAppTheme();
  const [entries, setEntries] = useState<GlossaryEntry[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<GlossaryEntry | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setEntries(await listGlossary(getDb()));
      setLoadError(null);
    } catch (e) {
      setLoadError((e as Error).message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const changed = useCallback(async () => {
    invalidateGlossary();
    await load();
  }, [load]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (entries ?? []).filter(
      (e) =>
        (filter === 'all' || e.ruleType === filter) &&
        (!q || e.sourcePhrase.toLowerCase().includes(q) || e.replacement.toLowerCase().includes(q)),
    );
  }, [entries, query, filter]);

  const onSave = async () => {
    if (!draft) return;
    const err = validateGlossary(draft);
    if (err) {
      setDraftError(err);
      return;
    }
    setSaving(true);
    try {
      await saveGlossaryEntry(getDb(), draft);
      setDraft(null);
      setDraftError(null);
      await changed();
    } catch (e) {
      setDraftError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const onToggle = async (e: GlossaryEntry, v: boolean) => {
    setEntries((list) => list?.map((x) => (x.id === e.id ? { ...x, enabled: v } : x)) ?? null);
    await setGlossaryEnabled(getDb(), e.id, v);
    await changed();
  };

  const onDelete = async () => {
    if (!toDelete) return;
    await deleteGlossaryEntry(getDb(), toDelete.id);
    setToDelete(null);
    await changed();
  };

  const restoreSamples = async () => {
    let added = 0;
    for (const g of DEFAULT_GLOSSARY) {
      try {
        await saveGlossaryEntry(getDb(), g);
        added++;
      } catch {
        /* duplicate: already present */
      }
    }
    setNotice(added ? `Restored ${added} sample term${added === 1 ? '' : 's'}.` : 'All sample terms are already in your glossary.');
    await changed();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AppHeader
        title="Custom Glossary"
        subtitle="Stored on this device"
        back={false}
        right={<IconButton icon="plus" label="Add term" onPress={() => { setDraft(EMPTY_DRAFT); setDraftError(null); }} color={colors.primary} />}
      />
      <Screen edges={['left', 'right']}>
        <TranscriptSearchBar value={query} onChangeText={setQuery} placeholder="Search terms" />
        <View style={{ height: spacing.md }} />
        <Segmented<Filter>
          accessibilityLabel="Filter by rule type"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All' },
            { value: 'preserve_english', label: 'English' },
            { value: 'translate_as', label: 'Translate' },
            { value: 'romanization_override', label: 'Spelling' },
          ]}
        />
        {notice ? <ErrorBanner tone="success" title={notice} onDismiss={() => setNotice(null)} /> : null}
        {loadError ? <ErrorBanner title="Could not load glossary" message={loadError} action={{ label: 'Retry', onPress: load }} /> : null}

        <SectionTitle action={{ label: 'Add term', onPress: () => { setDraft(EMPTY_DRAFT); setDraftError(null); } }}>
          Terms {entries ? `(${visible.length})` : ''}
        </SectionTitle>
        {entries == null && !loadError ? <LoadingState label="Loading glossary…" /> : null}
        {entries && visible.length === 0 ? (
          <EmptyState
            icon="book"
            title={entries.length === 0 ? 'Your glossary is empty' : 'No matching terms'}
            message={entries.length === 0 ? 'Add technical words to keep them in English, or restore the sample terms.' : 'Try a different search or filter.'}
            action={entries.length === 0 ? { label: 'Restore sample terms', onPress: restoreSamples } : undefined}
          />
        ) : null}
        {visible.map((e) => (
          <Card key={e.id} style={{ marginBottom: spacing.sm, paddingVertical: spacing.md }}>
            <Row style={{ alignItems: 'flex-start' }}>
              <View style={{ flex: 1, gap: 4 }}>
                <AppText variant="bodyStrong" color={e.enabled ? colors.text : colors.textMuted}>
                  {e.sourcePhrase}
                  {e.ruleType !== 'preserve_english' ? <AppText color={colors.textMuted}>{'  →  '}</AppText> : null}
                  {e.ruleType !== 'preserve_english' ? <AppText variant="bodyStrong" color={colors.hinglish}>{e.replacement}</AppText> : null}
                </AppText>
                <StatusChip label={RULE_LABEL[e.ruleType]} tone={e.ruleType === 'preserve_english' ? 'info' : e.ruleType === 'translate_as' ? 'success' : 'warning'} />
              </View>
              <Switch
                value={e.enabled}
                onValueChange={(v) => void onToggle(e, v)}
                accessibilityLabel={`${e.enabled ? 'Disable' : 'Enable'} ${e.sourcePhrase}`}
                trackColor={{ true: colors.primary, false: colors.border }}
                thumbColor="#FFFFFF"
              />
            </Row>
            <Row style={{ justifyContent: 'flex-end', marginTop: spacing.xs }}>
              <IconButton icon="edit" label={`Edit ${e.sourcePhrase}`} onPress={() => { setDraft({ ...e }); setDraftError(null); }} size={40} color={colors.textMuted} />
              <IconButton icon="trash" label={`Delete ${e.sourcePhrase}`} onPress={() => setToDelete(e)} size={40} color={colors.danger} />
            </Row>
          </Card>
        ))}
        {entries && entries.length > 0 ? (
          <Button label="Restore sample terms" kind="secondary" icon="refresh" onPress={restoreSamples} style={{ marginTop: spacing.sm }} />
        ) : null}

        <SectionTitle>How rules are applied</SectionTitle>
        <Card style={{ gap: spacing.sm }}>
          {[
            'Longer phrases are matched first, so "React Native" wins over "React".',
            '"Translate as" beats "Keep in English" when both exist for the same phrase.',
            'Matching is case-insensitive and only on whole words ("API" will not match inside "rapid").',
            'Spelling overrides run after romanisation. The source can be a Devanagari word (e.g. कार्य) or its Roman spelling.',
            'Changes apply to new captions immediately, including during a live meeting. Saved captions keep their stored text.',
            'Hinglish output is rule-based, not a language model. Review important translations.',
          ].map((t) => (
            <Row key={t} style={{ alignItems: 'flex-start' }}>
              <AppText color={colors.primary}>•</AppText>
              <AppText variant="caption" color={colors.textMuted} style={{ flex: 1 }}>{t}</AppText>
            </Row>
          ))}
        </Card>

        <TryIt entries={entries ?? []} />
      </Screen>

      <ConfirmDialog
        visible={!!draft}
        title={draft?.id ? 'Edit term' : 'Add term'}
        confirmLabel="Save"
        loading={saving}
        onCancel={() => { setDraft(null); setDraftError(null); }}
        onConfirm={onSave}>
        {draft ? (
          <View>
            <Field
              label={draft.ruleType === 'romanization_override' ? 'Hindi word (Devanagari or Roman)' : 'English phrase'}
              value={draft.sourcePhrase}
              onChangeText={(t) => setDraft({ ...draft, sourcePhrase: t })}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder={draft.ruleType === 'romanization_override' ? 'e.g. कार्य or karya' : 'e.g. pull request'}
            />
            {draft.ruleType !== 'preserve_english' ? (
              <Field
                label={draft.ruleType === 'translate_as' ? 'Hinglish wording' : 'Preferred spelling'}
                value={draft.replacement}
                onChangeText={(t) => setDraft({ ...draft, replacement: t })}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder={draft.ruleType === 'translate_as' ? 'e.g. PR' : 'e.g. kaam'}
              />
            ) : null}
            <RadioList value={draft.ruleType} onChange={(v) => setDraft({ ...draft, ruleType: v })} options={RULE_OPTIONS} />
            {draftError ? <AppText variant="caption" color={colors.danger} style={{ marginTop: spacing.sm }}>{draftError}</AppText> : null}
          </View>
        ) : null}
      </ConfirmDialog>

      <ConfirmDialog
        visible={!!toDelete}
        title="Delete term?"
        message={toDelete ? `"${toDelete.sourcePhrase}" will no longer be applied to new captions.` : undefined}
        confirmLabel="Delete"
        destructive
        onCancel={() => setToDelete(null)}
        onConfirm={onDelete}
      />
    </View>
  );
}

function TryIt({ entries }: { entries: GlossaryEntry[] }) {
  const { colors } = useAppTheme();
  const translationReady = useModelStore((s) => !!s.translation?.downloaded);
  const translationStyle = useSettingsStore((s) => s.settings.translationStyle);
  const preferIcu = useSettingsStore((s) => s.settings.preferIcuRomanization);
  const [text, setText] = useState('Please share the latest APK build and update the dashboard.');
  const [result, setResult] = useState<HinglishResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mask = useMemo(() => maskProtectedTerms(text, entries), [text, entries]);
  const canTranslate = isNativeAvailable && translationReady;

  const preview = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await translateToHinglish(text, (t) => MeetLingoNative.translate(t, 8000), {
        style: translationStyle === 'simple_hinglish' ? 'simple_hinglish' : 'natural_hinglish',
        glossary: entries.filter((e) => e.enabled),
        icu: (s) => MeetLingoNative.transliterateIcu(s),
        preferIcu,
      });
      setResult(r);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <SectionTitle>Try it</SectionTitle>
      <Card style={{ gap: spacing.sm }}>
        <Field
          label="English sentence"
          value={text}
          onChangeText={(t) => { setText(t); setResult(null); }}
          multiline
        />
        <AppText variant="label" color={colors.textMuted}>PROTECTED TERMS</AppText>
        {mask.slots.length ? (
          <Row style={{ flexWrap: 'wrap' }}>
            {mask.slots.map((s, i) => (
              <StatusChip key={`${s.token}-${i}`} label={s.ruleType === 'translate_as' ? `${s.original} → ${s.output}` : s.output} tone={s.ruleType === 'translate_as' ? 'success' : 'info'} />
            ))}
          </Row>
        ) : (
          <AppText variant="caption" color={colors.textMuted}>No enabled glossary terms found in this sentence.</AppText>
        )}
        {canTranslate ? (
          <Button label="Translate preview" icon="translate" onPress={preview} loading={busy} kind="secondary" />
        ) : (
          <AppText variant="caption" color={colors.textMuted}>
            {isNativeAvailable
              ? 'Install the Hindi translation model (Model Manager) to preview the full on-device translation.'
              : 'Translation preview needs the Android build with the on-device engine.'}
          </AppText>
        )}
        {error ? <ErrorBanner title="Preview failed" message={error} /> : null}
        {result ? (
          <View style={{ gap: 4 }}>
            <AppText variant="label" color={colors.textMuted}>ON-DEVICE RESULT (ML KIT + MEETLINGO RULES)</AppText>
            <AppText selectable>{result.hindi}</AppText>
            <AppText variant="bodyStrong" color={colors.hinglish} selectable>{result.hinglish}</AppText>
            {result.protectionFallback ? (
              <AppText variant="caption" color={colors.warning}>
                The translator altered the protected-term markers, so a fallback restore was used. Some terms may appear translated.
              </AppText>
            ) : null}
          </View>
        ) : null}
      </Card>
    </>
  );
}
