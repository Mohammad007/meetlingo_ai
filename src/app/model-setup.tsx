import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { isNativeAvailable, MeetLingoNative, type NativeModelStatus } from '@/../modules/meetlingo-native';
import { AppHeader, AppText, Button, Card, ErrorBanner, Icon, ModelDownloadRow, Row, Screen, StatusChip, ToggleRow } from '@/components';
import { ASR_MODELS, DEFAULT_ASR_MODEL_ID, extractedBytes, getAsrModel, TRANSLATION_MODEL } from '@/features/models/manifest';
import { useNetwork } from '@/hooks/useNetwork';
import { selectAsrReady, selectOfflineReady, useModelStore, type DownloadProgress } from '@/stores/modelStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { spacing, useAppTheme } from '@/theme';
import { formatBytes, formatDate } from '@/utils/format';

type RowStatus = 'not_installed' | 'installed' | 'unverified' | 'downloading' | 'error';

function asrRowStatus(st: NativeModelStatus | undefined, p: DownloadProgress | undefined): RowStatus {
  if (p && (p.phase === 'downloading' || p.phase === 'verifying' || p.phase === 'extracting')) return 'downloading';
  if (st?.downloading) return 'downloading';
  if (p?.phase === 'error') return 'error';
  if (st?.installed && st.verified) return 'installed';
  if (st?.installed) return 'unverified';
  return 'not_installed';
}

/** 04 Offline Model Setup */
export default function ModelSetupScreen() {
  const { colors } = useAppTheme();
  const net = useNetwork();
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);
  const store = useModelStore();
  const [freeBytes, setFreeBytes] = useState<number | null>(null);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const asr = getAsrModel(settings.asrModelId) ?? getAsrModel(DEFAULT_ASR_MODEL_ID) ?? ASR_MODELS[0];
  const asrStatus = store.asr[asr.id];
  const asrProgress = store.progress[asr.id];
  const trProgress = store.progress[TRANSLATION_MODEL.id];
  const asrState = asrRowStatus(asrStatus, asrProgress);
  const trInstalled = !!store.translation?.downloaded;
  const trState: RowStatus =
    trProgress?.phase === 'downloading' ? 'downloading' : trProgress?.phase === 'error' ? 'error' : trInstalled ? 'installed' : 'not_installed';
  const offlineReady = selectOfflineReady(store, asr.id);
  const asrReady = selectAsrReady(store, asr.id);

  useEffect(() => {
    void store.refresh();
    if (isNativeAvailable) {
      try {
        setFreeBytes(MeetLingoNative.getDeviceInfo().availableBytes);
      } catch {
        setFreeBytes(null);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const neededBytes = useMemo(
    () => (asrReady ? 0 : asr.archiveBytes + extractedBytes(asr) + 50 * 1024 * 1024),
    [asr, asrReady],
  );
  const enoughSpace = freeBytes == null ? null : freeBytes >= neededBytes;

  const run = async (fn: () => Promise<void>) => {
    setError(null);
    try {
      await fn();
    } catch (e) {
      const err = e as { code?: string; message?: string };
      if (err.code !== 'cancelled') setError(err.message ?? 'Download failed');
    } finally {
      if (isNativeAvailable) {
        try {
          setFreeBytes(MeetLingoNative.getDeviceInfo().availableBytes);
        } catch {
          /* ignore */
        }
      }
    }
  };

  const downloadAll = async () => {
    setDownloadingAll(true);
    await run(async () => {
      if (!asrReady) await store.downloadAsr(asr.id);
      if (!useModelStore.getState().translation?.downloaded) await store.downloadTranslation();
    });
    setDownloadingAll(false);
  };

  const finish = async () => {
    await update({ modelSetupDone: true });
    router.replace('/home' as never);
  };

  const asrSubtitle = asrStatus?.installed
    ? `Version ${asrStatus.version ?? asr.version}${asrStatus.installedAt ? ` · installed ${formatDate(asrStatus.installedAt)}` : ''}`
    : asr.description;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AppHeader title="Set up Offline AI" subtitle="Download once, caption without Internet" back={router.canGoBack()} />
      <Screen
        footer={
          <View style={{ gap: spacing.sm }}>
            {offlineReady ? (
              <Button label="Use offline" icon="check" onPress={finish} />
            ) : (
              <Button
                label={`Download models (${formatBytes(asrReady ? 0 : asr.archiveBytes)}${trInstalled ? '' : ' + Hindi pack'})`}
                icon="download"
                onPress={downloadAll}
                loading={downloadingAll}
                disabled={!isNativeAvailable || net.online === false}
              />
            )}
            {!offlineReady ? <Button label="Skip for now" kind="ghost" onPress={finish} /> : null}
          </View>
        }>
        <AppText color={colors.textMuted} style={{ marginBottom: spacing.md }}>
          MeetLingo AI runs speech recognition and translation on this phone. These models must be downloaded once
          (Internet required). Afterwards, meetings work in airplane mode.
        </AppText>

        {!isNativeAvailable ? (
          <ErrorBanner
            title="Development build required"
            message="This build does not include the MeetLingo native engine (Expo Go and web can't run on-device speech recognition). Install the Android build with `npx expo run:android`."
          />
        ) : null}

        <Row style={{ marginBottom: spacing.md, flexWrap: 'wrap' }}>
          {net.online === false ? (
            <StatusChip label="Offline — connect to download" tone="danger" icon="wifi-off" />
          ) : net.online ? (
            <StatusChip label={net.isWifi ? 'Connected via Wi-Fi' : `Connected (${net.type})`} tone="success" icon="wifi" />
          ) : (
            <StatusChip label="Checking network…" tone="neutral" />
          )}
          {offlineReady ? <StatusChip label="Offline ready" tone="success" icon="check" /> : null}
        </Row>

        <ModelDownloadRow
          icon="mic"
          title={`${asr.name} (ASR)`}
          subtitle={asrSubtitle}
          sizeLabel={`Download ${formatBytes(asr.archiveBytes)} · ${formatBytes(extractedBytes(asr))} on device`}
          status={asrState}
          progress={asrProgress}
          onDownload={() => run(() => store.downloadAsr(asr.id))}
          onCancel={() => store.cancelAsr(asr.id)}
          footnote={`Licence: ${asr.license} Verified with SHA-256 after download.${
            asrStatus?.problems?.length ? ` Problems: ${asrStatus.problems.join(', ')}.` : ''
          }`}
        />

        <ModelDownloadRow
          icon="translate"
          title="Hindi translation model (EN → HI)"
          subtitle={trInstalled ? 'Installed by Google ML Kit on this device' : 'Google ML Kit on-device translation'}
          sizeLabel="Size not reported by ML Kit (Google documents roughly 30 MB per language)"
          status={trState}
          progress={trProgress}
          onDownload={() => run(() => store.downloadTranslation())}
          footnote={`${TRANSLATION_MODEL.license} Progress percentage is not available for this download.`}
        />

        <ToggleRow
          icon="wifi"
          title="Download over Wi-Fi only"
          subtitle="Avoid mobile data charges. Downloads fail on metered networks while this is on."
          value={settings.wifiOnlyDownloads}
          onChange={(v) => void update({ wifiOnlyDownloads: v })}
        />

        <Card style={{ gap: spacing.xs, marginTop: spacing.sm }}>
          <Row>
            <Icon name="database" color={colors.primary} size={18} />
            <AppText variant="bodyStrong">Storage</AppText>
          </Row>
          <AppText variant="caption" color={colors.textMuted}>
            Available: {freeBytes == null ? 'unknown' : formatBytes(freeBytes)}
            {neededBytes > 0 ? ` · Needed for speech model: about ${formatBytes(neededBytes)}` : ''}
          </AppText>
          {enoughSpace === false ? (
            <AppText variant="caption" color={colors.danger}>Not enough free space. Free up storage before downloading.</AppText>
          ) : null}
        </Card>

        {error ? <ErrorBanner title="Download problem" message={error} onDismiss={() => setError(null)} /> : null}
        {store.lastError && isNativeAvailable ? <ErrorBanner tone="warning" title="Model check failed" message={store.lastError} /> : null}

        {!offlineReady ? (
          <ErrorBanner
            tone="info"
            title="If you skip"
            message={
              !asrReady
                ? 'Live captions are unavailable until the speech model is installed. You can download it later in Settings → Offline Model Manager.'
                : 'Captions will be English only until the Hindi translation model is installed.'
            }
          />
        ) : null}
      </Screen>
    </View>
  );
}
