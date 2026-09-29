import '@/global.css';

import * as Sentry from '@sentry/react-native';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

import AppTabs from '@/components/app-tabs';
import { useTheme } from '@/hooks/use-theme';
import { fontAssets } from '@/lib/fonts';

const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
if (sentryDsn) {
  Sentry.init({ dsn: sentryDsn, enabled: !__DEV__, tracesSampleRate: 0.2 });
}

SplashScreen.preventAutoHideAsync();

function RootLayout() {
  const { name, colors } = useTheme();
  const [fontsLoaded, fontError] = useFonts(fontAssets);

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  const base = name === 'night' ? DarkTheme : DefaultTheme;
  return (
    <ThemeProvider
      value={{
        ...base,
        colors: {
          ...base.colors,
          primary: colors.primary,
          background: colors.bg,
          card: colors.surface,
          text: colors.ink,
          border: colors.line,
        },
      }}
    >
      <AppTabs />
    </ThemeProvider>
  );
}

export default sentryDsn ? Sentry.wrap(RootLayout) : RootLayout;
