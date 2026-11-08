import Constants from 'expo-constants';
import { router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText, Button, Logo, Wordmark } from '@/components';
import { LATEST_SCHEMA_VERSION } from '@/database/migrations';
import { bootstrap } from '@/services/bootstrap';
import { useAppStore } from '@/stores/appStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { palette, spacing } from '@/theme';

/**
 * 01 Splash. Performs the real startup work (database migrations, crash recovery, model verification)
 * and routes to onboarding or home. No artificial delay.
 */
export default function SplashRoute() {
  const [status, setStatus] = useState('Preparing local database…');
  const [error, setError] = useState<string | null>(null);
  const setBoot = useAppStore((s) => s.setBoot);
  const setBootError = useAppStore((s) => s.setBootError);

  const run = useCallback(async () => {
    setError(null);
    setStatus('Preparing local database…');
    try {
      const result = await bootstrap();
      setBoot(result);
      const s = useSettingsStore.getState().settings;
      if (!s.onboardingComplete) router.replace('/onboarding');
      else if (!s.permissionsReviewed) router.replace('/permissions');
      else if (!s.modelSetupDone) router.replace('/model-setup');
      else router.replace('/home');
    } catch (e) {
      const msg = (e as Error).message;
      setBootError(msg);
      setError(msg);
    } finally {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [setBoot, setBootError]);

  useEffect(() => {
    void run();
  }, [run]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.navy }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md }}>
        <Logo size={96} />
        <Wordmark color="#FFFFFF" size={34} />
        <AppText color="#CBD5E1" variant="bodyStrong">Understand every meeting</AppText>
        <View style={{ height: spacing.xl }} />
        {error ? (
          <View style={{ gap: spacing.md, alignItems: 'center' }}>
            <AppText color="#FCA5A5" style={{ textAlign: 'center' }}>Startup failed: {error}</AppText>
            <Button label="Try again" onPress={run} icon="refresh" />
          </View>
        ) : (
          <View style={{ alignItems: 'center', gap: spacing.sm }} accessibilityLiveRegion="polite">
            <ActivityIndicator color="#7DD3FC" />
            <AppText variant="caption" color="#CBD5E1">{status}</AppText>
          </View>
        )}
      </View>
      <AppText variant="caption" color="#94A3B8" style={{ textAlign: 'center', paddingBottom: spacing.lg }}>
        Version {Constants.expoConfig?.version ?? '1.0.0'} · DB schema v{LATEST_SCHEMA_VERSION} · On-device only
      </AppText>
    </SafeAreaView>
  );
}
