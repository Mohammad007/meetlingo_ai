import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { isNativeAvailable, MeetLingoNative } from '@/../modules/meetlingo-native';
import {
  AppHeader,
  AppText,
  CaptionCard,
  Card,
  ErrorBanner,
  IconButton,
  RadioList,
  Row,
  Screen,
  SectionTitle,
  Segmented,
  SettingsRow,
  ToggleRow,
} from '@/components';
import { getAsrModel } from '@/features/models/manifest';
import { useSettingsStore, type CaptionBackground } from '@/stores/settingsStore';
import { spacing, useAppTheme } from '@/theme';
import type { OutputMode, TranslationStyle } from '@/types';

const STYLE_OPTIONS: { value: TranslationStyle; label: string; description: string }[] = [
  {
    value: 'natural_hinglish',
    label: 'Natural Hinglish (recommended)',
    description: 'Roman Hindi with common English words restored (please, meeting, update). Best for most office conversations.',
  },
  {
    value: 'simple_hinglish',
    label: 'Simple Hinglish',
    description: 'Plain romanised Hindi of the translation, keeping glossary terms and English loanwords, without swapping formal Hindi words.',
  },
  { value: 'devanagari', label: 'Hindi (Devanagari)', description: 'Shows the ML Kit Hindi translation in Devanagari script.' },
  { value: 'english', label: 'English only', description: 'No translation. Captions show recognised English text only.' },
  { value: 'dual_language', label: 'Dual language', description: 'Hinglish line plus the Devanagari Hindi line beneath it.' },
];

const OUTPUT_OPTIONS: { value: OutputMode; label: string }[] = [
  { value: 'dual', label: 'English + Hinglish' },
  { value: 'hinglish', label: 'Hinglish' },
  { value: 'english', label: 'English' },
];

const BG_OPTIONS: { value: CaptionBackground; label: string }[] = [
  { value: 'navy', label: 'Navy' },
  { value: 'black', label: 'Black' },
  { value: 'white', label: 'White' },
];

/** 23 Language & Caption Preferences */
export default function PreferencesScreen() {
  const { colors } = useAppTheme();
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);
  const [icuAvailable, setIcuAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isNativeAvailable) {
      setIcuAvailable(false);
      return;
    }
    try {
      setIcuAvailable(MeetLingoNative.getDeviceInfo().icuTransliterator);
    } catch {
      setIcuAvailable(false);
    }
  }, []);

  const setFont = (delta: number) => void update({ captionFontSize: Math.max(13, Math.min(32, settings.captionFontSize + delta)) });
  const asr = getAsrModel(settings.asrModelId);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AppHeader title="Language & Captions" />
      <Screen>
        <ErrorBanner
          tone="info"
          title="About Hinglish output"
          message="Hinglish is produced by on-device translation (Google ML Kit, English → Hindi) plus rule-based romanisation and your glossary — not by a conversational AI. Wording can be formal or imperfect. Review and correct important captions in the transcript."
          action={{ label: 'Edit glossary', onPress: () => router.push('/glossary' as never) }}
        />

        <SectionTitle>Translation style</SectionTitle>
        <RadioList options={STYLE_OPTIONS} value={settings.translationStyle} onChange={(v) => void update({ translationStyle: v })} />

        <SectionTitle>Show captions</SectionTitle>
        <Segmented
          accessibilityLabel="Caption output"
          options={OUTPUT_OPTIONS}
          value={settings.outputMode}
          onChange={(v) => void update({ outputMode: v })}
        />

        <SectionTitle>Caption size</SectionTitle>
        <Card style={{ gap: spacing.md }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <IconButton icon="minus" label="Smaller captions" onPress={() => setFont(-1)} background={colors.surfaceAlt} disabled={settings.captionFontSize <= 13} />
            <AppText variant="bodyStrong">{settings.captionFontSize} pt</AppText>
            <IconButton icon="plus" label="Larger captions" onPress={() => setFont(1)} background={colors.surfaceAlt} disabled={settings.captionFontSize >= 32} />
          </Row>
          <AppText variant="label" color={colors.textMuted}>PREVIEW SAMPLE (not from a meeting)</AppText>
          <CaptionCard
            startMs={65_000}
            englishText="Please share the latest build."
            hinglishText="Please latest build share karein."
            hindiText="कृपया latest build साझा करें।"
            state="translated"
            outputMode={settings.outputMode}
            translationStyle={settings.translationStyle}
            fontSize={settings.captionFontSize}
          />
        </Card>

        <SectionTitle>Behaviour</SectionTitle>
        <Card style={{ paddingVertical: spacing.xs }}>
          <ToggleRow
            icon="list"
            title="Auto-scroll live captions"
            subtitle="Keep the newest caption in view during a meeting."
            value={settings.autoScroll}
            onChange={(v) => void update({ autoScroll: v })}
          />
          <ToggleRow
            icon="translate"
            title="Use Android ICU romanisation"
            subtitle={
              icuAvailable === false
                ? 'Not available on this device (needs Android 10+ and the native engine).'
                : 'Scholarly spelling from Android (e.g. "samajhana") instead of MeetLingo’s chat-style Hinglish rules.'
            }
            value={settings.preferIcuRomanization && icuAvailable !== false}
            disabled={icuAvailable === false}
            onChange={(v) => void update({ preferIcuRomanization: v })}
          />
        </Card>

        <SectionTitle>Full-screen caption background</SectionTitle>
        <Segmented
          accessibilityLabel="Full-screen caption background"
          options={BG_OPTIONS}
          value={settings.captionBackground}
          onChange={(v) => void update({ captionBackground: v })}
        />
        <Row style={{ marginTop: spacing.sm }} gap={spacing.sm}>
          {BG_OPTIONS.map((o) => {
            const bg = o.value === 'navy' ? '#102846' : o.value === 'black' ? '#000000' : '#FFFFFF';
            const fg = o.value === 'white' ? '#102846' : '#FFFFFF';
            return (
              <View
                key={o.value}
                style={{
                  flex: 1,
                  backgroundColor: bg,
                  borderRadius: 10,
                  padding: spacing.sm,
                  borderWidth: settings.captionBackground === o.value ? 2 : 1,
                  borderColor: settings.captionBackground === o.value ? colors.primary : colors.border,
                }}>
                <AppText variant="caption" color={fg} style={{ fontWeight: '700' }}>Aa</AppText>
              </View>
            );
          })}
        </Row>

        <SectionTitle>Audio processing</SectionTitle>
        <AppText variant="caption" color={colors.textMuted} style={{ marginBottom: spacing.sm }}>
          Helps the app focus on voices and ignore room noise. Applies from the next meeting or audio test. Each effect is
          used only if this phone supports it; the live screen shows what is actually active.
        </AppText>
        <Card style={{ paddingVertical: spacing.xs }}>
          <ToggleRow
            icon="activity"
            title="Voice-only filter"
            subtitle="On-device voice detection (Silero VAD). Fans, typing, music and silence are not sent to the speech engine, so fewer junk words and faster captions."
            value={settings.voiceFilter}
            onChange={(v) => void update({ voiceFilter: v })}
          />
          <ToggleRow
            icon="sliders"
            title="Noise suppression"
            subtitle="Android's built-in noise reduction for the microphone."
            value={settings.noiseSuppression}
            onChange={(v) => void update({ noiseSuppression: v })}
          />
          <ToggleRow
            icon="speaker"
            title="Automatic volume boost"
            subtitle="Raises quiet or distant speakers. Turn off if loud speakers sound distorted."
            value={settings.autoGain}
            onChange={(v) => void update({ autoGain: v })}
          />
          <ToggleRow
            icon="x"
            title="Hide filler sounds"
            subtitle={'Skips captions that are only "uh", "hmm" or a single noise word.'}
            value={settings.dropFillerCaptions}
            onChange={(v) => void update({ dropFillerCaptions: v })}
          />
        </Card>
        <AppText variant="bodyStrong" style={{ marginTop: spacing.md, marginBottom: spacing.sm }}>Microphone focus</AppText>
        <RadioList
          value={settings.micDirection}
          onChange={(v) => void update({ micDirection: v })}
          options={[
            { value: 'auto', label: 'Automatic', description: 'Android default pickup' },
            { value: 'towards_user', label: 'Screen side faces the speaker', description: 'Phone lying flat or held with the screen towards the person or laptop' },
            { value: 'away_from_user', label: 'Back side faces the speaker', description: 'Phone propped up with its back towards the person or laptop' },
          ]}
        />
        <AppText variant="caption" color={colors.textMuted} style={{ marginTop: spacing.sm }}>
          Microphone focus needs Android 10+ and a phone with more than one microphone. It reduces side noise but cannot
          isolate a single person.
        </AppText>

        <SectionTitle>Offline engine</SectionTitle>
        <Card style={{ paddingVertical: spacing.xs }}>
          <SettingsRow
            icon="cpu"
            title="Speech model"
            subtitle={asr ? asr.name : 'No model selected'}
            onPress={() => router.push('/models' as never)}
          />
          <SettingsRow icon="book" title="Custom glossary" subtitle="Keep technical words in English, set preferred spellings" onPress={() => router.push('/glossary' as never)} />
        </Card>
      </Screen>
    </View>
  );
}
