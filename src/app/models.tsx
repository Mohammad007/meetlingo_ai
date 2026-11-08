import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Linking, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { isNativeAvailable, MeetLingoNative } from '@/../modules/meetlingo-native';
import {
  AppHeader,
  AppText,
  Button,
  Card,
  ConfirmDialog,
  ErrorBanner,
  Icon,
  IconButton,
  ProgressBar,
  Row,
  StatusChip,
} from '@/components';
import { ASR_MODELS, extractedBytes, TRANSLATION_MODEL, type AsrModelEntry } from '@/features/models/manifest';
import { useModelStore } from '@/stores/modelStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { spacing, useAppTheme } from '@/theme';
import { formatBytes, formatDate } from '@/utils/format';

type PendingDelete = { kind: 'asr'; id: string; name: string } | { kind: 'translation'; name: string } | null;

/** 24 Offline Model Manager */
export default function ModelManagerScreen() {
  const { colors } = useAppTheme();
  const store = useModelStore();
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);
  const sessionActive = useSessionStore((s) => !!s.meeting);
  const [storage, setStorage] = useState<{ free: number; total: number } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const readStorage = useCallback(() => {
    if (!isNativeAvailable) return;
    try {
      const d = MeetLingoNative.getDeviceInfo();
      setStorage({ free: d.availableBytes, total: d.totalBytes });
    } catch {
      setStorage(null);
    }
  }, []);

  const refresh = useCallback(async () => {
    await store.refresh();
    readStorage();
  }, [store, readStorage]);

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const guard = async (fn: () => Promise<void>) => {
    setError(null);
    try {
      await fn();
    } catch (e) {
      const err = e as { code?: string; message?: string };
      if (err.code !== 'cancelled') setError(err.message ?? 'Operation failed');
    } finally {
      readStorage();
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    await guard(async () => {
      if (pendingDelete.kind === 'asr') await store.deleteAsr(pendingDelete.id);
      else await store.deleteTranslation();
    });
    setDeleting(false);
    setPendingDelete(null);
  };

  const renderAsr = (m: AsrModelEntry) => {
    const st = store.asr[m.id];
    const p = store.progress[m.id];
    const busy = !!st?.downloading || (p && ['downloading', 'verifying', 'extracting'].includes(p.phase));
    const verified = !!st?.installed && !!st.verified;
    const selected = settings.asrModelId === m.id;
    const pct = p && p.totalBytes > 0 ? p.downloadedBytes / p.totalBytes : 0;
    return (
      <Card key={m.id} style={{ marginBottom: spacing.md, gap: spacing.sm, borderColor: selected ? colors.primary : colors.border, borderWidth: selected ? 2 : 1 }}>
        <Row style={{ alignItems: 'flex-start', gap: spacing.md }}>
          <Icon name="mic" color={colors.primary} />
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="bodyStrong">{m.name}</AppText>
            <AppText variant="caption" color={colors.textMuted}>{m.description}</AppText>
          </View>
        </Row>
        <Row style={{ flexWrap: 'wrap' }}>
          {selected ? <StatusChip label="Selected" tone="info" icon="check" /> : null}
          {m.recommended ? <StatusChip label="Recommended" tone="neutral" /> : null}
          {verified ? <StatusChip label="Verified" tone="success" icon="check" /> : st?.installed ? <StatusChip label="Needs repair" tone="warning" icon="alert" /> : <StatusChip label="Not installed" tone="neutral" />}
          {st?.updateAvailable ? <StatusChip label="Update available" tone="warning" /> : null}
        </Row>
        <Detail label="Version" value={st?.installed ? `${st.version} (catalogue ${m.version})` : m.version} />
        <Detail label="Source" value={m.source} />
        <Detail label="Download size" value={formatBytes(m.archiveBytes)} />
        <Detail label="Size on device" value={formatBytes(extractedBytes(m))} />
        {st?.installedAt ? <Detail label="Installed" value={formatDate(st.installedAt)} /> : null}
        {st?.sha256 ? <Detail label="SHA-256" value={`${st.sha256.slice(0, 16)}…`} /> : null}
        <Detail label="Features" value={m.features.join(', ')} />
        <Detail label="Speed" value={`RTF ≈ ${m.desktopRealTimeFactor} measured on desktop — benchmark on your phone in Diagnostics`} />
        <AppText variant="caption" color={colors.textMuted}>Licence: {m.license}</AppText>
        <Button label="View licence" kind="ghost" compact icon="external" onPress={() => Linking.openURL(m.licenseUrl)} style={{ alignSelf: 'flex-start' }} />
        {st?.problems?.length ? <AppText variant="caption" color={colors.danger}>Problems: {st.problems.join(', ')}</AppText> : null}
        {busy && p ? (
          <View style={{ gap: 4 }}>
            <ProgressBar value={pct} indeterminate={p.phase !== 'downloading' || p.totalBytes <= 0} />
            <AppText variant="caption" color={colors.textMuted}>
              {p.phase === 'downloading' ? `Downloading ${Math.round(pct * 100)}% (${formatBytes(p.downloadedBytes)} of ${formatBytes(p.totalBytes)})` : p.phase === 'verifying' ? 'Verifying checksum…' : 'Extracting…'}
            </AppText>
          </View>
        ) : null}
        {p?.phase === 'error' ? <AppText variant="caption" color={colors.danger}>{p.message ?? 'Download failed'}</AppText> : null}
        <Row style={{ justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          {busy ? <Button label="Cancel" kind="ghost" compact onPress={() => store.cancelAsr(m.id)} /> : null}
          {!busy && !verified ? (
            <Button
              label={p?.phase === 'error' ? 'Retry' : st?.installed ? 'Reinstall' : 'Install'}
              icon={p?.phase === 'error' ? 'refresh' : 'download'}
              compact
              disabled={!isNativeAvailable}
              onPress={() => guard(() => store.downloadAsr(m.id))}
            />
          ) : null}
          {!busy && verified && st?.updateAvailable ? (
            <Button label="Update" icon="download" compact disabled={sessionActive} onPress={() => guard(() => store.downloadAsr(m.id))} />
          ) : null}
          {verified && !selected ? <Button label="Use this model" kind="secondary" compact onPress={() => void update({ asrModelId: m.id })} /> : null}
          {st?.installed && !busy ? (
            <Button label="Delete" kind="ghost" icon="trash" compact disabled={sessionActive} onPress={() => setPendingDelete({ kind: 'asr', id: m.id, name: m.name })} />
          ) : null}
        </Row>
      </Card>
    );
  };

  const trInstalled = !!store.translation?.downloaded;
  const trProgress = store.progress[TRANSLATION_MODEL.id];
  const trBusy = trProgress?.phase === 'downloading';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AppHeader
        title="Offline Model Manager"
        right={<IconButton icon="refresh" label="Refresh model status" onPress={() => void refresh()} />}
      />
      <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl, maxWidth: 760, width: '100%', alignSelf: 'center' }}
          refreshControl={<RefreshControl refreshing={store.checking} onRefresh={() => void refresh()} colors={[colors.primary]} />}>
          {!isNativeAvailable ? (
            <ErrorBanner title="Development build required" message="Model management needs the MeetLingo native engine (not available in Expo Go or web)." />
          ) : null}
          {sessionActive ? (
            <ErrorBanner tone="warning" title="Meeting in progress" message="Models can't be deleted or updated while a meeting is being captioned. Stop the meeting first." />
          ) : null}
          {error ? <ErrorBanner title="Model operation failed" message={error} onDismiss={() => setError(null)} /> : null}

          <Card style={{ marginBottom: spacing.lg, gap: spacing.xs }}>
            <Row>
              <Icon name="database" color={colors.primary} size={18} />
              <AppText variant="bodyStrong">Device storage</AppText>
            </Row>
            {storage ? (
              <>
                <ProgressBar value={storage.total > 0 ? 1 - storage.free / storage.total : 0} color={colors.accent} />
                <AppText variant="caption" color={colors.textMuted}>
                  {formatBytes(storage.free)} free of {formatBytes(storage.total)}
                </AppText>
              </>
            ) : (
              <AppText variant="caption" color={colors.textMuted}>Storage information unavailable.</AppText>
            )}
          </Card>

          <AppText variant="heading" style={{ marginBottom: spacing.sm }}>Speech recognition (English)</AppText>
          {ASR_MODELS.map(renderAsr)}

          <AppText variant="heading" style={{ marginVertical: spacing.sm }}>Translation</AppText>
          <Card style={{ gap: spacing.sm }}>
            <Row style={{ alignItems: 'flex-start', gap: spacing.md }}>
              <Icon name="translate" color={colors.primary} />
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="bodyStrong">{TRANSLATION_MODEL.name}</AppText>
                <AppText variant="caption" color={colors.textMuted}>{TRANSLATION_MODEL.description}</AppText>
              </View>
            </Row>
            <Row>{trInstalled ? <StatusChip label="Installed (reported by ML Kit)" tone="success" icon="check" /> : <StatusChip label="Not installed" tone="neutral" />}</Row>
            <Detail label="Version" value={TRANSLATION_MODEL.version} />
            <Detail label="Source" value="Google Play services / ML Kit model manager" />
            <Detail label="Size" value="Not reported by the ML Kit API" />
            <Detail label="Romanisation" value={store.translation?.icuAvailable ? 'MeetLingo rules (Android ICU also available)' : 'MeetLingo rules (Android ICU not available on this OS)'} />
            <AppText variant="caption" color={colors.textMuted}>Licence: {TRANSLATION_MODEL.license}</AppText>
            <Button label="View terms" kind="ghost" compact icon="external" onPress={() => Linking.openURL(TRANSLATION_MODEL.licenseUrl)} style={{ alignSelf: 'flex-start' }} />
            {trBusy ? <ProgressBar value={0} indeterminate /> : null}
            {trProgress?.phase === 'error' ? <AppText variant="caption" color={colors.danger}>{trProgress.message ?? 'Download failed'}</AppText> : null}
            <Row style={{ justifyContent: 'flex-end' }}>
              {!trInstalled ? (
                <Button
                  label={trProgress?.phase === 'error' ? 'Retry' : 'Install'}
                  icon="download"
                  compact
                  loading={trBusy}
                  disabled={!isNativeAvailable}
                  onPress={() => guard(() => store.downloadTranslation())}
                />
              ) : (
                <Button label="Delete" kind="ghost" icon="trash" compact disabled={sessionActive} onPress={() => setPendingDelete({ kind: 'translation', name: TRANSLATION_MODEL.name })} />
              )}
            </Row>
          </Card>

          <Button label="Language & caption preferences" kind="ghost" icon="sliders" onPress={() => router.push('/preferences' as never)} style={{ marginTop: spacing.lg }} />
        </ScrollView>
      </SafeAreaView>

      <ConfirmDialog
        visible={!!pendingDelete}
        title="Delete model?"
        message={`${pendingDelete?.name ?? ''} will be removed from this phone. You will need Internet to download it again${
          pendingDelete?.kind === 'translation' ? ', and captions will be English only until then.' : ', and live captions need an installed speech model.'
        }`}
        confirmLabel="Delete"
        destructive
        loading={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </View>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  const { colors } = useAppTheme();
  return (
    <Row style={{ alignItems: 'flex-start' }}>
      <AppText variant="caption" color={colors.textMuted} style={{ width: 110 }}>{label}</AppText>
      <AppText variant="caption" style={{ flex: 1 }}>{value}</AppText>
    </Row>
  );
}
