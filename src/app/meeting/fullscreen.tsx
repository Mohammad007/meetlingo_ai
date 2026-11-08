import { useKeepAwake } from 'expo-keep-awake';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText, Icon, IconButton, Row, StatusChip } from '@/components';
import { useElapsed } from '@/hooks/useElapsed';
import { useSessionStore } from '@/stores/sessionStore';
import { useSettingsStore, type CaptionBackground } from '@/stores/settingsStore';
import { spacing } from '@/theme';
import { formatClock } from '@/utils/format';

const BG: Record<CaptionBackground, { bg: string; fg: string; sub: string; accent: string; control: string }> = {
  navy: { bg: '#102846', fg: '#FFFFFF', sub: '#CBD5E1', accent: '#7DD3FC', control: '#1E3A5F' },
  black: { bg: '#000000', fg: '#FFFFFF', sub: '#D4D4D4', accent: '#7DD3FC', control: '#262626' },
  white: { bg: '#FFFFFF', fg: '#102846', sub: '#475569', accent: '#0369A1', control: '#E2E8F0' },
};

/** 10 Full-Screen Captions — large, high-contrast, for a conference table. Keeps the screen awake. */
export default function FullscreenRoute() {
  useKeepAwake('meetlingo-fullscreen');
  const meeting = useSessionStore((s) => s.meeting);
  const captions = useSessionStore((s) => s.captions);
  const interim = useSessionStore((s) => s.interim);
  const nativeState = useSessionStore((s) => s.nativeState);
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);
  const elapsed = useElapsed();
  const theme = BG[settings.captionBackground];
  const size = settings.fullscreenFontSize;

  const last = useMemo(() => {
    const finals = captions.filter((c) => c.englishText);
    return finals.slice(-2);
  }, [captions]);
  const current = last[last.length - 1];
  const previous = last.length > 1 ? last[0] : null;
  const style = meeting?.translationStyle ?? settings.translationStyle;
  const translated = (c: typeof current | null) =>
    !c ? null : style === 'english' ? null : style === 'devanagari' ? c.hindiText : c.hinglishText;

  const cycleBg = () => {
    const order: CaptionBackground[] = ['navy', 'black', 'white'];
    update({ captionBackground: order[(order.indexOf(settings.captionBackground) + 1) % order.length] });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <Row style={{ padding: spacing.md, justifyContent: 'space-between' }}>
        {meeting ? (
          nativeState === 'listening' ? <StatusChip label={`LIVE ${formatClock(elapsed)}`} tone="live" /> : <StatusChip label={nativeState === 'paused' ? 'PAUSED' : nativeState.toUpperCase()} tone="warning" />
        ) : (
          <StatusChip label="No meeting running" tone="neutral" />
        )}
        <IconButton icon="shrink" label="Exit full screen" color={theme.fg} background={theme.control} onPress={() => router.back()} />
      </Row>

      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end', padding: spacing.xl, gap: spacing.lg }}>
        {!current && !interim ? (
          <AppText style={{ fontSize: size * 0.7, textAlign: 'center' }} color={theme.sub}>
            {meeting ? 'Waiting for speech…' : 'Start a meeting to show captions.'}
          </AppText>
        ) : null}
        {previous && translated(previous) ? (
          <AppText style={{ fontSize: size * 0.6, lineHeight: size * 0.8 }} color={theme.sub}>{translated(previous)}</AppText>
        ) : null}
        {current ? (
          <View style={{ gap: spacing.sm }} accessibilityLiveRegion="polite">
            {translated(current) ? (
              <AppText style={{ fontSize: size, lineHeight: size * 1.25, fontWeight: '800' }} color={theme.fg}>{translated(current)}</AppText>
            ) : style !== 'english' ? (
              <AppText style={{ fontSize: size * 0.55 }} color={theme.sub}>{current.state === 'failed' ? 'Translation unavailable' : 'Translating…'}</AppText>
            ) : null}
            {settings.showEnglishInFullscreen || style === 'english' ? (
              <AppText style={{ fontSize: style === 'english' ? size : size * 0.55, lineHeight: (style === 'english' ? size : size * 0.55) * 1.3 }} color={style === 'english' ? theme.fg : theme.sub}>
                {current.englishText}
              </AppText>
            ) : null}
          </View>
        ) : null}
        {interim ? (
          <AppText style={{ fontSize: size * 0.5, fontStyle: 'italic' }} color={theme.accent}>{interim.text}</AppText>
        ) : null}
      </ScrollView>

      <Row style={{ padding: spacing.md, justifyContent: 'center', gap: spacing.md, flexWrap: 'wrap' }}>
        <IconButton icon="minus" label="Smaller text" color={theme.fg} background={theme.control} onPress={() => update({ fullscreenFontSize: Math.max(20, size - 4) })} />
        <AppText color={theme.sub} variant="label">{size}pt</AppText>
        <IconButton icon="plus" label="Larger text" color={theme.fg} background={theme.control} onPress={() => update({ fullscreenFontSize: Math.min(72, size + 4) })} />
        <Pressable
          onPress={() => update({ showEnglishInFullscreen: !settings.showEnglishInFullscreen })}
          accessibilityRole="switch"
          accessibilityState={{ checked: settings.showEnglishInFullscreen }}
          accessibilityLabel="Show original English"
          style={{ minHeight: 48, paddingHorizontal: spacing.md, borderRadius: 24, backgroundColor: theme.control, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name={settings.showEnglishInFullscreen ? 'checkbox-on' : 'checkbox'} color={theme.fg} size={18} />
          <AppText variant="label" color={theme.fg}>English</AppText>
        </Pressable>
        <Pressable
          onPress={cycleBg}
          accessibilityRole="button"
          accessibilityLabel={`Background: ${settings.captionBackground}. Tap to change`}
          style={{ minHeight: 48, paddingHorizontal: spacing.md, borderRadius: 24, backgroundColor: theme.control, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name={settings.captionBackground === 'white' ? 'sun' : 'moon'} color={theme.fg} size={18} />
          <AppText variant="label" color={theme.fg}>{settings.captionBackground}</AppText>
        </Pressable>
      </Row>
    </SafeAreaView>
  );
}
