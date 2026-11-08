import Constants from 'expo-constants';
import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import {
  addNativeListener,
  isNativeAvailable,
  MeetLingoNative,
  type AudioLevelEvent,
  type DeviceInfo,
  type SessionMetrics,
} from '@/../modules/meetlingo-native';
import { AppHeader, AppText, Button, Card, ErrorBanner, Icon, Row, Screen, SectionTitle, StatusChip } from '@/components';
import { getDb, getMigrationReport } from '@/database/db';
import { sqliteSelfTest } from '@/database/repositories/data';
import { shareTextFile } from '@/features/export/exportService';
import { ASR_MODELS } from '@/features/models/manifest';
import { useNetwork } from '@/hooks/useNetwork';
import { getTranslationQueueStats } from '@/services/meetingSession';
import { checkMicrophone } from '@/services/permissions';
import { getLog, getMetrics } from '@/services/telemetry';
import { resolveUsableAsrModel, useModelStore } from '@/stores/modelStore';
import { useSessionStore } from '@/stores/sessionStore';
import { spacing, useAppTheme } from '@/theme';
import { formatBytes } from '@/utils/format';
import { getAudioOptions } from '@/stores/settingsStore';

type CheckStatus = 'pass' | 'warn' | 'fail' | 'skip' | 'running';

interface CheckResult {
  id: string;
  title: string;
  status: CheckStatus;
  detail: string;
  fix?: string;
}

const AUDIO_TEST_ID = '__audio_test__';
const THERMAL = ['None', 'Light', 'Moderate', 'Severe', 'Critical', 'Emergency', 'Shutdown'];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Records native level events for [ms] while a microphone-only test runs. */
async function measureMic(ms: number): Promise<{ ok: boolean; code?: string; device?: string; peakDb: number; noiseDb: number; frames: number; speech: number }> {
  const levels: AudioLevelEvent[] = [];
  const sub = addNativeListener('onAudioLevel', (e) => {
    if (e.mode === 'test') levels.push(e);
  });
  try {
    const start = await MeetLingoNative.startAudioTest(null, getAudioOptions());
    if (!start.ok) return { ok: false, code: start.code, peakDb: -120, noiseDb: -120, frames: 0, speech: 0 };
    await sleep(ms);
    await MeetLingoNative.stopAudioTest();
    const peakDb = levels.reduce((a, l) => Math.max(a, l.dbfs), -120);
    const noiseDb = levels.length ? levels[levels.length - 1].noiseFloorDb : -120;
    return { ok: true, device: start.deviceName, peakDb, noiseDb, frames: levels.length, speech: levels.filter((l) => l.isSpeech).length };
  } finally {
    sub.remove();
  }
}

export default function DiagnosticsScreen() {
  const { colors } = useAppTheme();
  const network = useNetwork();
  const meetingActive = useSessionStore((s) => !!s.meeting);
  const [results, setResults] = useState<CheckResult[]>([]);
  const [running, setRunning] = useState(false);
  const [device, setDevice] = useState<DeviceInfo | null>(null);
  const [metrics, setMetrics] = useState<SessionMetrics | null>(null);
  const [asrText, setAsrText] = useState<string | null>(null);
  const [asrState, setAsrState] = useState<'idle' | 'listening' | 'done' | 'error'>('idle');
  const [asrMessage, setAsrMessage] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const resultsRef = useRef<CheckResult[]>([]);

  useEffect(() => {
    if (!isNativeAvailable) return;
    try {
      setDevice(MeetLingoNative.getDeviceInfo());
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!meetingActive || !isNativeAvailable) {
      setMetrics(null);
      return;
    }
    const tick = () => {
      try {
        setMetrics(MeetLingoNative.getSessionMetrics());
      } catch {
        /* ignore */
      }
    };
    tick();
    const t = setInterval(tick, 2000);
    return () => clearInterval(t);
  }, [meetingActive]);

  const put = (r: CheckResult) => {
    const next = [...resultsRef.current.filter((x) => x.id !== r.id), r];
    resultsRef.current = next;
    setResults(next);
  };

  const run = useCallback(async () => {
    setRunning(true);
    resultsRef.current = [];
    setResults([]);
    const nativeSkip = (id: string, title: string) =>
      put({ id, title, status: 'skip', detail: 'Needs the Android build with the on-device engine (not Expo Go / web).' });

    // 1. Microphone permission
    const mic = await checkMicrophone();
    put({
      id: 'perm',
      title: 'Microphone permission',
      status: mic === 'granted' ? 'pass' : 'fail',
      detail: mic === 'granted' ? 'Granted.' : 'Not granted.',
      fix: mic === 'granted' ? undefined : 'Open Settings → Permissions → Microphone and allow it.',
    });

    // 2. Mic test + acoustic level
    if (!isNativeAvailable) nativeSkip('mic', 'Microphone test & acoustic level');
    else if (meetingActive) put({ id: 'mic', title: 'Microphone test & acoustic level', status: 'skip', detail: 'A meeting is using the microphone right now.' });
    else if (mic !== 'granted') put({ id: 'mic', title: 'Microphone test & acoustic level', status: 'skip', detail: 'Skipped: microphone permission missing.' });
    else {
      put({ id: 'mic', title: 'Microphone test & acoustic level', status: 'running', detail: 'Listening for 3 seconds — speak normally…' });
      try {
        const r = await measureMic(3000);
        if (!r.ok) {
          put({
            id: 'mic',
            title: 'Microphone test & acoustic level',
            status: 'fail',
            detail: `Could not open the microphone (${r.code}).`,
            fix: r.code === 'mic_busy' ? 'Another app (often a call or recorder) holds the microphone. Close it and retry.' : 'Restart the app; if it persists, restart the phone.',
          });
        } else if (r.frames === 0) {
          put({ id: 'mic', title: 'Microphone test & acoustic level', status: 'fail', detail: 'No audio levels were received.', fix: 'The input may be silenced by the system. Check that no call is active.' });
        } else {
          const quiet = r.peakDb < -45;
          const noisy = r.noiseDb > -35;
          put({
            id: 'mic',
            title: 'Microphone test & acoustic level',
            status: quiet || noisy ? 'warn' : 'pass',
            detail: `${r.device ?? 'Input'} · peak ${r.peakDb.toFixed(0)} dBFS · noise floor ${r.noiseDb.toFixed(0)} dBFS · speech frames ${r.speech}/${r.frames}`,
            fix: quiet
              ? 'Very low level. Move the phone closer to the speaker or raise laptop speaker volume.'
              : noisy
                ? 'High background noise. Reduce fan/AC noise or move the phone closer to the speaker.'
                : undefined,
          });
        }
      } catch (e) {
        put({ id: 'mic', title: 'Microphone test & acoustic level', status: 'fail', detail: (e as Error).message });
      }
    }

    // 3. Speech model status
    const modelState = useModelStore.getState();
    if (isNativeAvailable) await modelState.refresh();
    const ms = useModelStore.getState();
    const verified = ASR_MODELS.filter((m) => ms.asr[m.id]?.verified);
    const broken = ASR_MODELS.filter((m) => ms.asr[m.id]?.installed && !ms.asr[m.id]?.verified);
    if (!isNativeAvailable) nativeSkip('asr', 'Speech model');
    else
      put({
        id: 'asr',
        title: 'Speech model',
        status: verified.length ? (broken.length ? 'warn' : 'pass') : 'fail',
        detail: verified.length ? `Verified: ${verified.map((m) => m.name).join(', ')}` : 'No verified speech model installed.',
        fix: broken.length
          ? `Reinstall ${broken.map((m) => m.name).join(', ')} in Model Manager (files missing or wrong size).`
          : verified.length
            ? undefined
            : 'Open Model Manager and download the Standard English model (needs Internet once).',
      });

    // 4. Translator
    if (!isNativeAvailable) nativeSkip('mt', 'Hindi translation model');
    else if (!ms.translation?.downloaded)
      put({ id: 'mt', title: 'Hindi translation model', status: 'fail', detail: 'Not downloaded. Captions will be English only.', fix: 'Download it in Model Manager (needs Internet once).' });
    else {
      try {
        const t0 = Date.now();
        const out = await MeetLingoNative.translate('Please share the latest build', 8000);
        const dt = Date.now() - t0;
        put({ id: 'mt', title: 'Hindi translation model', status: dt > 3000 ? 'warn' : 'pass', detail: `Installed. Test translation took ${dt} ms → ${out}`, fix: dt > 3000 ? 'Translation is slow; the phone may be busy or thermally throttled.' : undefined });
      } catch (e) {
        put({ id: 'mt', title: 'Hindi translation model', status: 'fail', detail: (e as Error).message, fix: 'Delete and re-download the Hindi model in Model Manager.' });
      }
    }

    // 5. SQLite
    const sq = await sqliteSelfTest(getDb());
    const rep = getMigrationReport();
    put({
      id: 'db',
      title: 'Local database (SQLite)',
      status: sq.ok ? (rep?.ftsAvailable ? 'pass' : 'warn') : 'fail',
      detail: `${sq.ok ? `Write/read OK in ${sq.ms} ms` : `Failed: ${sq.error}`} · schema v${rep?.toVersion ?? '?'} · full-text search ${rep?.ftsAvailable ? 'FTS5' : 'unavailable (using indexed fallback)'}`,
      fix: sq.ok ? undefined : 'Free some storage and restart the app. Export your data first if possible.',
    });

    // 6. Disk
    if (!isNativeAvailable) nativeSkip('disk', 'Free storage');
    else {
      const d = MeetLingoNative.getDeviceInfo();
      setDevice(d);
      const low = d.availableBytes < 500 * 1024 * 1024;
      put({
        id: 'disk',
        title: 'Free storage',
        status: low ? 'warn' : 'pass',
        detail: `${formatBytes(d.availableBytes)} free of ${formatBytes(d.totalBytes)}`,
        fix: low ? 'Less than 500 MB free. Long meetings and model downloads may fail; free up space.' : undefined,
      });

      // 7. Same-phone capture
      const cap = MeetLingoNative.getCaptureSupport();
      put({
        id: 'cap',
        title: 'Same-phone capture support',
        status: cap.status === 'unsupported' ? 'warn' : 'pass',
        detail: `Android ${d.release} (SDK ${d.sdkInt}): ${cap.reason}`,
        fix: 'For Meet/Zoom/Teams, play the call on a laptop speaker and use the phone microphone. Use "Check Capture Compatibility" for a real test.',
      });

      // 8. Device
      const thermal = d.thermalStatus >= 0 ? THERMAL[d.thermalStatus] ?? String(d.thermalStatus) : 'Not reported';
      put({
        id: 'device',
        title: 'Device',
        status: !d.arm64 || d.thermalStatus >= 3 || (d.batteryPercent < 15 && !d.charging) ? 'warn' : 'pass',
        detail: `${d.model} · ABI ${d.abis.join(', ')} · thermal ${thermal} · battery ${d.batteryPercent}%${d.charging ? ' (charging)' : ''}${d.powerSave ? ' · power saver ON' : ''}`,
        fix: !d.arm64
          ? 'This is not an ARM64 device; recognition may be slow or unsupported.'
          : d.thermalStatus >= 3
            ? 'Phone is hot. Recognition may slow down; remove the case or let it cool.'
            : d.batteryPercent < 15 && !d.charging
              ? 'Battery is low. Connect a charger for long meetings.'
              : d.powerSave
                ? 'Power saver can slow recognition.'
                : undefined,
      });
    }

    // 9. Network (informational)
    put({
      id: 'net',
      title: 'Network',
      status: 'pass',
      detail: network.online ? `Online (${network.type}). Only used for model downloads.` : 'Offline. Live captions work offline once models are installed.',
    });

    setRunning(false);
  }, [meetingActive, network.online, network.type]);

  const runAsrTest = async () => {
    const usable = resolveUsableAsrModel(useModelStore.getState());
    if (!usable) {
      setAsrState('error');
      setAsrMessage('No verified speech model installed.');
      return;
    }
    setAsrText(null);
    setAsrMessage(null);
    setAsrState('listening');
    let latest = '';
    let final = false;
    const sub = addNativeListener('onCaption', (e) => {
      if (e.meetingId !== AUDIO_TEST_ID) return;
      latest = e.englishText;
      setAsrText(e.englishText);
      if (e.state === 'final') final = true;
    });
    try {
      const start = await MeetLingoNative.startAudioTest(usable.model, getAudioOptions());
      if (!start.ok || !start.asrReady) {
        setAsrState('error');
        setAsrMessage(start.ok ? `Speech engine could not load: ${start.asrError ?? 'unknown error'}` : `Microphone unavailable (${start.code}).`);
        await MeetLingoNative.stopAudioTest();
        return;
      }
      const t0 = Date.now();
      while (Date.now() - t0 < 8000 && !final) await sleep(200);
      await MeetLingoNative.stopAudioTest();
      setAsrState('done');
      if (!latest) setAsrMessage('No speech was recognised in 8 seconds. Speak a short English sentence clearly and retry.');
    } catch (e) {
      setAsrState('error');
      setAsrMessage((e as Error).message);
    } finally {
      sub.remove();
    }
  };

  const exportLog = async () => {
    setExportError(null);
    const lines: string[] = [];
    lines.push('MeetLingo AI diagnostics report');
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push(`App version: ${Constants.expoConfig?.version ?? '1.0.0'}`);
    lines.push('Contains NO transcript text and NO audio.');
    lines.push('');
    lines.push('== Checks ==');
    for (const r of results) lines.push(`[${r.status.toUpperCase()}] ${r.title}: ${r.detail}${r.fix ? ` | Fix: ${r.fix}` : ''}`);
    if (!results.length) lines.push('(checks not run)');
    lines.push('', '== Device ==');
    if (device) {
      const { playbackCapture, ...rest } = device;
      lines.push(JSON.stringify({ ...rest, playbackCapture: playbackCapture.status }, null, 2));
    } else lines.push(isNativeAvailable ? '(unavailable)' : 'Native engine not available in this build');
    const rep = getMigrationReport();
    lines.push('', '== Database ==', JSON.stringify({ schema: rep?.toVersion, fts: rep?.ftsAvailable, skipped: rep?.skippedOptional }, null, 2));
    lines.push('', '== Models ==');
    const ms = useModelStore.getState();
    for (const m of ASR_MODELS) lines.push(`${m.id}: installed=${!!ms.asr[m.id]?.installed} verified=${!!ms.asr[m.id]?.verified} version=${ms.asr[m.id]?.version ?? '-'}`);
    lines.push(`mlkit-en-hi: downloaded=${!!ms.translation?.downloaded}`);
    lines.push('', '== Live pipeline ==');
    lines.push(metrics ? JSON.stringify({ ...metrics, meetingId: metrics.meetingId ? '(active)' : null }, null, 2) : '(no active meeting)');
    lines.push('Translation queue: ' + JSON.stringify(getTranslationQueueStats()));
    lines.push('', '== Local counters ==', JSON.stringify(getMetrics(), null, 2));
    lines.push('', '== Event log ==');
    for (const l of getLog()) lines.push(`${new Date(l.at).toISOString()} ${l.level.toUpperCase()} ${l.message}`);
    try {
      await shareTextFile('meetlingo-diagnostics.txt', lines.join('\n'));
    } catch (e) {
      setExportError((e as Error).message);
    }
  };

  const queue = getTranslationQueueStats();
  const counters = getMetrics();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AppHeader title="Troubleshooting" subtitle="Diagnostics run on this device" />
      <Screen edges={['bottom', 'left', 'right']}>
        {!isNativeAvailable ? (
          <ErrorBanner
            tone="warning"
            title="On-device engine not available"
            message="Microphone, speech model, translator, storage, capture and device checks need the Android development or release build. Only the database and network checks can run here."
          />
        ) : null}
        <Button label={running ? 'Running checks…' : 'Run diagnostics'} icon="activity" onPress={run} loading={running} />

        {results.length ? <SectionTitle>Results</SectionTitle> : null}
        {results.map((r) => (
          <CheckRow key={r.id} r={r} />
        ))}

        <SectionTitle>Speech recognition test</SectionTitle>
        <Card style={{ gap: spacing.sm }}>
          <AppText variant="caption" color={colors.textMuted}>
            Say a short English sentence after tapping the button. The text below comes from the installed on-device speech model.
          </AppText>
          <Button
            label={asrState === 'listening' ? 'Listening (up to 8 s)…' : 'Test speech recognition'}
            icon="mic"
            kind="secondary"
            loading={asrState === 'listening'}
            disabled={!isNativeAvailable || meetingActive}
            onPress={runAsrTest}
          />
          {meetingActive ? <AppText variant="caption" color={colors.textMuted}>Unavailable while a meeting is running.</AppText> : null}
          {asrText ? <AppText variant="bodyStrong">“{asrText}”</AppText> : null}
          {asrMessage ? <AppText variant="caption" color={asrState === 'error' ? colors.danger : colors.textMuted}>{asrMessage}</AppText> : null}
        </Card>

        <SectionTitle>Live pipeline</SectionTitle>
        <Card style={{ gap: 4 }}>
          {metrics ? (
            <>
              <Metric label="State" value={metrics.state} />
              <Metric label="Input" value={metrics.deviceName || '—'} />
              <Metric label="Dropped audio frames" value={String(metrics.droppedFrames)} warn={metrics.droppedFrames > 0} />
              <Metric label="Audio queue depth (max)" value={`${metrics.queueDepth} (${metrics.maxQueueDepth})`} />
              <Metric label="Real-time factor" value={metrics.realTimeFactor != null ? metrics.realTimeFactor.toFixed(2) : '—'} warn={(metrics.realTimeFactor ?? 0) > 0.8} />
              <Metric label="Final captions" value={String(metrics.finalsEmitted)} />
              <Metric label="Mic silenced by system" value={metrics.micSilenced ? 'Yes' : 'No'} warn={metrics.micSilenced} />
            </>
          ) : (
            <AppText variant="caption" color={colors.textMuted}>No active meeting. Metrics appear here while listening.</AppText>
          )}
          <Metric label="Translations (done / failed / dropped)" value={`${queue.processed} / ${queue.failed} / ${queue.dropped}`} warn={queue.dropped > 0} />
          <Metric label="Translation latency (avg)" value={queue.avgLatencyMs != null ? `${queue.avgLatencyMs} ms` : '—'} />
          {Object.entries(counters).map(([k, v]) => (
            <Metric key={k} label={k} value={String(v)} />
          ))}
        </Card>

        <SectionTitle>Share with support</SectionTitle>
        <Card style={{ gap: spacing.sm }}>
          <AppText variant="caption" color={colors.textMuted}>
            The diagnostic log contains check results, device information, model status and error counters. It never includes transcript text or audio.
            It is only shared when you choose an app in the share sheet.
          </AppText>
          <Button label="Export diagnostic log" icon="share" kind="secondary" onPress={exportLog} />
          {exportError ? <AppText variant="caption" color={colors.danger}>{exportError}</AppText> : null}
        </Card>
      </Screen>
    </View>
  );
}

function CheckRow({ r }: { r: CheckResult }) {
  const { colors } = useAppTheme();
  const tone = { pass: 'success', warn: 'warning', fail: 'danger', skip: 'neutral', running: 'info' } as const;
  const label = { pass: 'Pass', warn: 'Check', fail: 'Fail', skip: 'Skipped', running: 'Running' };
  const icon = { pass: 'check-circle', warn: 'alert', fail: 'x', skip: 'info', running: 'clock' } as const;
  const color = { pass: colors.success, warn: colors.warning, fail: colors.danger, skip: colors.textMuted, running: colors.primary }[r.status];
  return (
    <Card style={{ marginBottom: spacing.sm, gap: 6 }}>
      <Row>
        <Icon name={icon[r.status]} color={color} size={20} />
        <AppText variant="bodyStrong" style={{ flex: 1 }}>{r.title}</AppText>
        <StatusChip label={label[r.status]} tone={tone[r.status]} />
      </Row>
      <AppText variant="caption" color={colors.textMuted}>{r.detail}</AppText>
      {r.fix ? <AppText variant="caption" color={colors.text}>Fix: {r.fix}</AppText> : null}
    </Card>
  );
}

function Metric({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  const { colors } = useAppTheme();
  return (
    <Row style={{ justifyContent: 'space-between' }}>
      <AppText variant="caption" color={colors.textMuted} style={{ flex: 1 }}>{label}</AppText>
      <AppText variant="caption" color={warn ? colors.warning : colors.text}>{value}</AppText>
    </Row>
  );
}
