import { router } from 'expo-router';
import { View } from 'react-native';

import { AppHeader, AppText, Card, MeetingModeCard, Screen } from '@/components';
import { useSettingsStore } from '@/stores/settingsStore';
import { spacing, useAppTheme } from '@/theme';
import type { MeetingMode } from '@/types';

/** 06 Meeting Mode Selector */
export default function MeetingModeScreen() {
  const { colors } = useAppTheme();
  const lastMode = useSettingsStore((s) => s.settings.lastMode);

  const choose = (mode: MeetingMode) => {
    void useSettingsStore.getState().update({ lastMode: mode });
    if (mode === 'physical') router.push('/meeting/setup?mode=physical' as never);
    else if (mode === 'laptop') router.push('/meeting/laptop-guide' as never);
    else router.push('/meeting/compatibility' as never);
  };

  return (
    <View style={{ flex: 1 }}>
      <AppHeader title="Choose meeting mode" />
      <Screen>
        <AppText color={colors.textMuted} style={{ marginBottom: spacing.lg }}>
          Select how the meeting audio will reach this phone. Everything is processed on this device.
        </AppText>
        <MeetingModeCard
          icon="users"
          title="In-person meeting"
          description="Uses this phone's microphone in the room. Place the phone on the table, close to the speakers."
          badge={{ label: 'Recommended', tone: 'success' }}
          selected={lastMode === 'physical'}
          onPress={() => choose('physical')}
        />
        <MeetingModeCard
          icon="laptop"
          title="Meeting on laptop"
          description="Play the meeting (Meet, Zoom, Teams…) from your laptop speakers; the phone microphone listens. Works with any meeting app."
          selected={lastMode === 'laptop'}
          onPress={() => choose('laptop')}
        />
        <MeetingModeCard
          icon="phone"
          title="Online on this phone"
          description="Google Meet / Zoom / Teams running on this same phone. Android usually blocks other apps from capturing call audio, so this often does not work."
          badge={{ label: 'Limited support', tone: 'warning' }}
          selected={lastMode === 'same_phone'}
          onPress={() => choose('same_phone')}
        />
        <Card style={{ backgroundColor: colors.infoSurface, borderColor: 'transparent' }}>
          <AppText variant="bodyStrong">How audio enters the app</AppText>
          <AppText variant="caption" color={colors.text} style={{ marginTop: 4 }}>
            In-person and laptop modes use the phone microphone only after you tap Start Listening. Same-phone mode can
            only use Android&apos;s playback capture for apps that allow it — call audio is never intercepted.
          </AppText>
        </Card>
      </Screen>
    </View>
  );
}
