import { router } from 'expo-router';
import { View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { AppHeader, AppText, Button, Card, ErrorBanner, Icon, Row, Screen, SectionTitle } from '@/components';
import { useDraftStore } from '@/stores/sessionStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { spacing, useAppTheme } from '@/theme';

const TIPS = [
  { title: 'Use the laptop speakers', body: 'Play the meeting (Meet, Zoom, Teams…) out loud from the laptop. Turn off laptop headphones or earbuds.' },
  { title: 'Volume around 60–80%', body: 'Loud and clear, without distortion. The audio test warns you if it is too quiet or clipping.' },
  { title: 'Place the phone 30–100 cm away', body: 'Put the phone near the laptop speaker with its microphone (bottom edge) facing the laptop.' },
  { title: 'Keep the room quiet', body: 'Fans, typing and side conversations reduce caption accuracy.' },
];

function Illustration() {
  const { colors } = useAppTheme();
  return (
    <Svg width="100%" height={150} viewBox="0 0 320 150" accessibilityLabel="Laptop speaker sound travelling to the phone microphone">
      {/* laptop */}
      <Rect x={20} y={30} width={130} height={82} rx={8} fill={colors.surface} stroke={colors.text} strokeWidth={3} />
      <Rect x={32} y={42} width={106} height={58} rx={4} fill={colors.infoSurface} />
      <Path d="M8 120h154l-10 10H18z" fill={colors.text} />
      <Circle cx={60} cy={66} r={9} fill={colors.primary} />
      <Circle cx={88} cy={66} r={9} fill={colors.primary} opacity={0.6} />
      <Circle cx={116} cy={66} r={9} fill={colors.primary} opacity={0.35} />
      {/* sound waves */}
      <Path d="M170 60q10 15 0 30M184 50q18 25 0 50M198 40q26 35 0 70" stroke={colors.primary} strokeWidth={4} fill="none" strokeLinecap="round" />
      {/* phone */}
      <Rect x={232} y={22} width={64} height={112} rx={12} fill={colors.surface} stroke={colors.text} strokeWidth={3} />
      <Rect x={242} y={36} width={44} height={74} rx={4} fill={colors.infoSurface} />
      <Rect x={258} y={56} width={12} height={22} rx={6} fill={colors.primary} />
      <Path d="M252 72a12 12 0 0 0 24 0M264 84v6" stroke={colors.primary} strokeWidth={3} fill="none" strokeLinecap="round" />
      <Circle cx={264} cy={122} r={3} fill={colors.text} />
    </Svg>
  );
}

/** 14 Laptop Meeting Guide */
export default function LaptopGuideScreen() {
  const { colors } = useAppTheme();
  const settings = useSettingsStore((s) => s.settings);
  const setDraft = useDraftStore((s) => s.setDraft);

  const goSetup = () => {
    void useSettingsStore.getState().update({ lastMode: 'laptop' });
    const prev = useDraftStore.getState().draft;
    setDraft({
      title: prev?.title ?? '',
      mode: 'laptop',
      source: 'microphone',
      outputMode: prev?.outputMode ?? settings.outputMode,
      translationStyle: prev?.translationStyle ?? settings.translationStyle,
      saveTranscript: prev?.saveTranscript ?? settings.saveTranscriptDefault,
      saveAudio: false,
      keepAwake: prev?.keepAwake ?? settings.keepAwake,
    });
    router.push('/meeting/setup?mode=laptop' as never);
  };

  return (
    <View style={{ flex: 1 }}>
      <AppHeader title="Meeting on laptop" />
      <Screen footer={<Button label="Start Laptop Meeting" icon="laptop" onPress={goSetup} />}>
        <Card style={{ alignItems: 'center', gap: spacing.sm }}>
          <Illustration />
          <AppText variant="heading" style={{ textAlign: 'center' }}>Laptop speaker → phone microphone</AppText>
          <AppText variant="caption" color={colors.textMuted} style={{ textAlign: 'center' }}>
            Join the meeting on your laptop as usual. The phone does not join the meeting — it simply listens to the laptop speakers and
            captions what it hears, on this device.
          </AppText>
        </Card>

        <SectionTitle>Tips for good captions</SectionTitle>
        {TIPS.map((t, i) => (
          <Row key={t.title} style={{ alignItems: 'flex-start', gap: spacing.md, marginBottom: spacing.md }}>
            <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
              <AppText variant="label" color="#FFFFFF">{i + 1}</AppText>
            </View>
            <View style={{ flex: 1 }}>
              <AppText variant="bodyStrong">{t.title}</AppText>
              <AppText variant="caption" color={colors.textMuted}>{t.body}</AppText>
            </View>
          </Row>
        ))}

        <ErrorBanner
          tone="warning"
          title="Using headphones on the laptop?"
          message="If the meeting plays through laptop headphones, the phone hears nothing. Switch the laptop output to its speakers, or use a separate input you are authorised to use."
        />

        <Card style={{ marginTop: spacing.md }}>
          <Row style={{ gap: spacing.md }}>
            <Icon name="mic" color={colors.primary} />
            <View style={{ flex: 1 }}>
              <AppText variant="bodyStrong">Test the microphone first</AppText>
              <AppText variant="caption" color={colors.textMuted}>After setup, the audio test shows the live level and a test caption before you start.</AppText>
            </View>
          </Row>
          <Button label="Set up & test microphone" kind="secondary" compact onPress={goSetup} style={{ marginTop: spacing.md }} />
        </Card>

        <AppText variant="caption" color={colors.textMuted} style={{ marginTop: spacing.lg }}>
          A laptop companion app (peer-to-peer) is out of scope for this version. There is no pairing code or QR step.
        </AppText>
      </Screen>
    </View>
  );
}
