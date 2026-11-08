import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect, Text as SvgText } from 'react-native-svg';

import { AppText, Button, Row } from '@/components';
import { useSettingsStore } from '@/stores/settingsStore';
import { palette, spacing, TOUCH, useAppTheme } from '@/theme';

function ListenArt({ size }: { size: number }) {
  return (
    <Svg width={size} height={size * 0.75} viewBox="0 0 240 180">
      <Rect x={50} y={40} width={140} height={90} rx={10} fill={palette.navy} />
      <Rect x={58} y={48} width={124} height={74} rx={6} fill="#E6F6FD" />
      <Rect x={30} y={130} width={180} height={10} rx={5} fill="#94A3B8" />
      <Circle cx={120} cy={78} r={16} fill={palette.sky} />
      <Path d="M100 100a20 14 0 0 1 40 0v10h-40z" fill={palette.sky} />
      {[0, 1, 2, 3, 4].map((i) => (
        <Rect key={i} x={196 + i * 7} y={70 - [6, 14, 22, 14, 6][i] / 2} width={4} height={[6, 14, 22, 14, 6][i]} rx={2} fill={palette.sky} />
      ))}
    </Svg>
  );
}

function HinglishArt({ size }: { size: number }) {
  return (
    <Svg width={size} height={size * 0.75} viewBox="0 0 240 180">
      <Rect x={20} y={30} width={96} height={48} rx={12} fill="#FFFFFF" stroke={palette.navy} strokeWidth={3} />
      <Path d="M40 78l-6 16 18-16z" fill={palette.navy} />
      <SvgText x={68} y={60} fontSize={18} fontWeight="bold" fill={palette.navy} textAnchor="middle">English</SvgText>
      <Path d="M122 70c20 0 30 10 36 24" stroke={palette.slate} strokeWidth={3} fill="none" strokeLinecap="round" />
      <Path d="M150 92l9 4 2-10" stroke={palette.slate} strokeWidth={3} fill="none" strokeLinecap="round" />
      <Rect x={118} y={100} width={104} height={48} rx={12} fill={palette.sky} />
      <Path d="M200 148l6 16-18-16z" fill={palette.sky} />
      <SvgText x={170} y={130} fontSize={18} fontWeight="bold" fill="#FFFFFF" textAnchor="middle">Hinglish</SvgText>
    </Svg>
  );
}

function OfflineArt({ size }: { size: number }) {
  return (
    <Svg width={size} height={size * 0.75} viewBox="0 0 240 180">
      <Rect x={84} y={20} width={72} height={140} rx={14} fill={palette.navy} />
      <Rect x={92} y={34} width={56} height={108} rx={6} fill="#E6F6FD" />
      <Path d="M100 74a28 28 0 0 1 40 0M107 84a18 18 0 0 1 26 0" stroke={palette.slate} strokeWidth={4} fill="none" strokeLinecap="round" />
      <Circle cx={120} cy={96} r={4} fill={palette.slate} />
      <Path d="M100 62l40 46" stroke={palette.red} strokeWidth={4} strokeLinecap="round" />
      <Circle cx={168} cy={128} r={22} fill="#15803D" />
      <Path d="M158 128l7 7 13-14" stroke="#FFFFFF" strokeWidth={4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

const PANELS = [
  {
    title: 'Listen in Real Time',
    body: 'Place your phone near the speakers or on the meeting table. English speech becomes live captions as people talk.',
    Art: ListenArt,
  },
  {
    title: 'Understand in Hinglish',
    body: 'Each finished phrase is translated on your phone and shown in Roman-script Hinglish, keeping technical words in English.',
    Art: HinglishArt,
  },
  {
    title: 'Works Without Internet',
    body: 'Download the speech and Hindi models once. After that, meetings are captioned fully on-device — even in airplane mode. No account, no server.',
    Art: OfflineArt,
  },
];

/** 02 Onboarding */
export default function OnboardingScreen() {
  const { colors } = useAppTheme();
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  const [i, setI] = useState(0);
  const update = useSettingsStore((s) => s.update);
  const last = i === PANELS.length - 1;
  const panel = PANELS[i];
  const artSize = Math.min(landscape ? height * 0.6 : width * 0.8, 360);

  const finish = async () => {
    await update({ onboardingComplete: true });
    router.replace('/permissions' as never);
  };

  const Art = panel.Art;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <Row style={{ justifyContent: 'flex-end', paddingHorizontal: spacing.lg, minHeight: TOUCH }}>
        {!last ? (
          <Pressable onPress={finish} accessibilityRole="button" hitSlop={12} style={{ minHeight: TOUCH, justifyContent: 'center' }}>
            <AppText variant="bodyStrong" color={colors.primary}>Skip</AppText>
          </Pressable>
        ) : null}
      </Row>
      <View
        style={{
          flex: 1,
          flexDirection: landscape ? 'row' : 'column',
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: spacing.xl,
          gap: spacing.xl,
          maxWidth: 900,
          width: '100%',
          alignSelf: 'center',
        }}>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Art size={artSize} />
        </View>
        <View style={{ flex: landscape ? 1 : undefined, gap: spacing.md, alignItems: landscape ? 'flex-start' : 'center' }}>
          <AppText variant="display" accessibilityRole="header" style={{ textAlign: landscape ? 'left' : 'center' }}>
            {panel.title}
          </AppText>
          <AppText color={colors.textMuted} style={{ textAlign: landscape ? 'left' : 'center', maxWidth: 480 }}>
            {panel.body}
          </AppText>
        </View>
      </View>
      <View style={{ padding: spacing.lg, gap: spacing.lg, maxWidth: 560, width: '100%', alignSelf: 'center' }}>
        <Row style={{ justifyContent: 'center' }} gap={8}>
          {PANELS.map((_, k) => (
            <View
              key={k}
              accessibilityLabel={k === i ? `Page ${k + 1} of ${PANELS.length}` : undefined}
              style={{ width: k === i ? 22 : 8, height: 8, borderRadius: 4, backgroundColor: k === i ? colors.primary : colors.border }}
            />
          ))}
        </Row>
        <Row gap={spacing.md}>
          {i > 0 ? <Button label="Back" kind="secondary" onPress={() => setI(i - 1)} style={{ flex: 1 }} /> : null}
          <Button
            label={last ? 'Get Started' : 'Next'}
            icon={last ? 'check' : 'chevron-right'}
            onPress={last ? finish : () => setI(i + 1)}
            style={{ flex: 2 }}
          />
        </Row>
      </View>
    </SafeAreaView>
  );
}
