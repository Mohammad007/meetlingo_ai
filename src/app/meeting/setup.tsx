import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';

import { isNativeAvailable, MeetLingoNative } from '@/../modules/meetlingo-native';
import {
  AppHeader,
  AppText,
  Button,
  Card,
  ErrorBanner,
  Field,
  Icon,
  RadioList,
  Row,
  Screen,
  SectionTitle,
  ToggleRow,
} from '@/components';
import { checkMicrophone, openAppSettings, requestMicrophone, type PermissionStatus } from '@/services/permissions';
import { useModelStore, useUsableAsrModel } from '@/stores/modelStore';
import { useDraftStore } from '@/stores/sessionStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { spacing, useAppTheme } from '@/theme';
import type { AudioSource, MeetingMode, OutputMode, TranslationStyle } from '@/types';

const go = (path: string) => router.push(path as never);

function defaultTitle() {
  const d = new Date();
  return `Meeting – ${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
}

const OUTPUT_OPTIONS: { value: OutputMode; label: string; description: string }[] = [
  { value: 'dual', label: 'Both (English + Hinglish)', description: 'English line with the Hinglish line underneath' },
  { value: 'hinglish', label: 'Hinglish only', description: 'Show only the translated line' },
  { value: 'english', label: 'English only', description: 'No translation shown' },
];

const STYLE_OPTIONS: { value: TranslationStyle; label: string; description: string }[] = [
  { value: 'natural_hinglish', label: 'Natural Hinglish', description: 'Roman script, keeps common English words (recommended)' },
  { value: 'simple_hinglish', label: 'Simple Hinglish', description: 'Roman-script Hindi with fewer English substitutions' },
  { value: 'devanagari', label: 'Hindi (Devanagari)', description: 'ML Kit Hindi output in Devanagari script' },
  { value: 'dual_language', label: 'Dual language', description: 'Hinglish plus the Devanagari line' },
  { value: 'english', label: 'English only', description: 'Skip translation entirely' },
];

/** 07 Meeting Setup */
export default function MeetingSetupScreen() {
  const { colors } = useAppTheme();
  const params = useLocalSearchParams<{ mode?: string; source?: string }>();
  const settings = useSettingsStore((s) => s.settings);
  const existingDraft = useDraftStore((s) => s.draft);
  const setDraft = useDraftStore((s) => s.setDraft);
  const mode: MeetingMode =
    params.mode === 'physical' || params.mode === 'laptop' || params.mode === 'same_phone' ? params.mode : settings.lastMode;

  const [title, setTitle] = useState(existingDraft?.title || defaultTitle());
  const [outputMode, setOutputMode] = useState<OutputMode>(existingDraft?.outputMode ?? settings.outputMode);
  const [style, setStyle] = useState<TranslationStyle>(existingDraft?.translationStyle ?? settings.translationStyle);
  const [keepAwake, setKeepAwake] = useState(existingDraft?.keepAwake ?? settings.keepAwake);
  const [saveTranscript, setSaveTranscript] = useState(existingDraft?.saveTranscript ?? settings.saveTranscriptDefault);
  const [saveAudio, setSaveAudio] = useState(false);
  const [mic, setMic] = useState<PermissionStatus | 'unknown'>('unknown');
  const [busy, setBusy] = useState(false);

  const usableModel = useUsableAsrModel();
  const translationReady = useModelStore((s) => !!s.translation?.downloaded);

  const capture = useMemo(() => {
    if (mode !== 'same_phone' || !isNativeAvailable) return null;
    try {
      return MeetLingoNative.getCaptureSupport();
    } catch {
      return null;
    }
  }, [mode]);
  const wantsPlayback = mode === 'same_phone' && params.source === 'permitted_playback';
  const [source, setSource] = useState<AudioSource>(wantsPlayback && capture?.hasConsent ? 'permitted_playback' : 'microphone');

  useFocusEffect(
    useCallback(() => {
      checkMicrophone().then(setMic).catch(() => setMic('unknown'));
    }, []),
  );

  const needsTranslation = style !== 'english' && outputMode !== 'english';

  const onContinue = async () => {
    setBusy(true);
    try {
      let status = await checkMicrophone();
      if (status !== 'granted') status = await requestMicrophone();
      setMic(status);
      if (status !== 'granted') return;
      setDraft({
        title: title.trim() || defaultTitle(),
        mode,
        source,
        outputMode,
        translationStyle: outputMode === 'english' ? 'english' : style,
        saveTranscript,
        saveAudio: saveTranscript && saveAudio,
        keepAwake,
      });
      void useSettingsStore.getState().update({ lastMode: mode });
      go('/meeting/audio-test');
    } finally {
      setBusy(false);
    }
  };

  const sourceLabel =
    mode === 'physical'
      ? 'Phone microphone (in the room)'
      : mode === 'laptop'
        ? 'Phone microphone listening to laptop speakers'
        : source === 'permitted_playback'
          ? 'Permitted playback capture (apps that allow it)'
          : 'Phone microphone';

  return (
    <View style={{ flex: 1 }}>
      <AppHeader title="Meeting setup" subtitle={mode === 'physical' ? 'In-person' : mode === 'laptop' ? 'Laptop meeting' : 'Same phone (limited)'} />
      <Screen
        footer={
          <Button
            label="Next: Audio test"
            icon="mic"
            onPress={onContinue}
            loading={busy}
            disabled={!usableModel || !isNativeAvailable}
          />
        }>
        {!isNativeAvailable ? (
          <ErrorBanner title="On-device engine unavailable" message="This build does not include the native speech engine. Install the Android development build." />
        ) : null}
        {!usableModel ? (
          <ErrorBanner
            title="Speech model not installed"
            message="A verified English speech model is required to transcribe. Download it once; it then works offline."
            action={{ label: 'Set up models', onPress: () => go('/model-setup') }}
          />
        ) : usableModel.fallback ? (
          <ErrorBanner tone="info" title={`Using ${usableModel.model.name}`} message="Your preferred speech model is not installed, so another verified model will be used." />
        ) : null}
        {needsTranslation && !translationReady ? (
          <ErrorBanner
            tone="warning"
            title="Hindi model not installed"
            message="Captions will be English-only until the Hindi translation model is installed. Saved English captions can be translated later."
            action={{ label: 'Install Hindi model', onPress: () => go('/model-setup') }}
          />
        ) : null}
        {mic === 'blocked' ? (
          <ErrorBanner
            title="Microphone blocked"
            message="Microphone access was permanently denied. Enable it in Android settings to continue."
            action={{ label: 'Open settings', onPress: openAppSettings }}
          />
        ) : mic === 'denied' ? (
          <ErrorBanner tone="warning" title="Microphone permission needed" message="You'll be asked when you continue. Listening starts only when you tap Start Listening." />
        ) : null}

        <Field label="Meeting title" value={title} onChangeText={setTitle} maxLength={120} placeholder="Weekly standup" />

        <AppText variant="label" color={colors.textMuted}>AUDIO SOURCE</AppText>
        <Card style={{ marginTop: 6, marginBottom: spacing.md }}>
          <Row style={{ gap: spacing.md }}>
            <Icon name={source === 'permitted_playback' ? 'speaker' : 'mic'} color={colors.primary} />
            <AppText variant="bodyStrong" style={{ flex: 1 }}>{sourceLabel}</AppText>
          </Row>
          {mode === 'same_phone' ? (
            <View style={{ marginTop: spacing.sm, gap: spacing.sm }}>
              {capture?.status === 'unsupported' ? (
                <AppText variant="caption" color={colors.textMuted}>{capture.reason}</AppText>
              ) : capture?.hasConsent ? (
                <RadioList<AudioSource>
                  value={source}
                  onChange={setSource}
                  options={[
                    { value: 'permitted_playback', label: 'Permitted playback capture', description: 'Only media/game audio from apps that allow capture. Call audio is not included.' },
                    { value: 'microphone', label: 'Phone microphone', description: 'May hear nothing if a call app is holding the microphone.' },
                  ]}
                />
              ) : (
                <>
                  <AppText variant="caption" color={colors.textMuted}>
                    Playback capture needs a compatibility check and screen-capture consent first. Without it the phone microphone is used, which
                    usually cannot hear a call running on this phone.
                  </AppText>
                  <Button label="Check capture compatibility" kind="secondary" compact onPress={() => go('/meeting/compatibility')} />
                </>
              )}
            </View>
          ) : null}
        </Card>

        <SectionTitle>Show subtitles</SectionTitle>
        <RadioList value={outputMode} onChange={setOutputMode} options={OUTPUT_OPTIONS} />

        {outputMode !== 'english' ? (
          <>
            <SectionTitle>Translation style</SectionTitle>
            <RadioList value={style} onChange={setStyle} options={STYLE_OPTIONS} />
            <AppText variant="caption" color={colors.textMuted} style={{ marginTop: spacing.sm }}>
              Hinglish is produced by on-device Hindi translation plus rule-based romanisation and your glossary. It is not perfect and is not
              conversational AI output.
            </AppText>
          </>
        ) : null}

        <SectionTitle>Session options</SectionTitle>
        <Card style={{ paddingVertical: spacing.xs }}>
          <ToggleRow icon="sun" title="Keep screen awake" subtitle="Prevents the screen from sleeping while listening" value={keepAwake} onChange={setKeepAwake} />
          <ToggleRow
            icon="database"
            title="Save transcript on this phone"
            subtitle={saveTranscript ? 'Captions are stored in local SQLite and appear in History' : 'Captions disappear when the meeting ends'}
            value={saveTranscript}
            onChange={(v) => {
              setSaveTranscript(v);
              if (!v) setSaveAudio(false);
            }}
          />
          <ToggleRow
            icon="save"
            title="Record raw audio (optional)"
            subtitle={
              saveTranscript
                ? 'Off by default. If on, a WAV file is saved only in this app’s private storage. You can delete it from the transcript.'
                : 'Requires saving the transcript.'
            }
            value={saveAudio}
            disabled={!saveTranscript}
            onChange={setSaveAudio}
          />
        </Card>
        {saveAudio ? (
          <ErrorBanner
            tone="info"
            title="Audio recording consent"
            message="Make sure everyone in the meeting agrees to being recorded. Audio stays on this phone and is never uploaded."
          />
        ) : null}
      </Screen>
    </View>
  );
}
