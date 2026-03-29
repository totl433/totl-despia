import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { Button, Card, Screen, ThemeProvider, TotlText, lightColors, darkColors } from '@totl/ui';
import { AppState } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Font from 'expo-font';

import { queryClient, queryPersister } from './lib/queryClient';
import { initSentry } from './lib/sentry';
import { supabase } from './lib/supabase';
import { initPushSdk, registerForPushNotifications, resetPushSessionState, updateHeartbeat } from './lib/push';
import { ConfettiProvider } from './lib/confetti';
import { LeagueUnreadCountsProvider } from './context/LeagueUnreadCountsContext';
import { ThemePreferenceProvider, useThemePreference } from './context/ThemePreferenceContext';
import { envStatus } from './env';
import AuthScreen from './screens/AuthScreen';
import AppNavigator from './navigation/AppNavigator';

function AppInner() {
  const { isDark } = useThemePreference();
  const themeTokens = React.useMemo(
    () => ({ color: isDark ? { ...darkColors } : { ...lightColors } }),
    [isDark]
  );
  const [fontsReady, setFontsReady] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    initSentry().catch(() => {});
  }, []);

  useEffect(() => {
    let alive = true;
    Font.loadAsync({
      'Gramatika-Regular': require('../../../public/Fonts/Gramatika-Regular.ttf'),
      'Gramatika-Medium': require('../../../public/Fonts/Gramatika-Medium.ttf'),
      'Gramatika-Bold': require('../../../public/Fonts/Gramatika-Bold.ttf'),
      'Gramatika-Italic': require('../../../public/Fonts/Gramatika-Italic.ttf'),
      'BarlowCondensed-Medium': require('../../../public/Fonts/BarlowCondensed-Medium.ttf'),
      'BarlowCondensed-Light': require('../../../public/Fonts/BarlowCondensed-Light.ttf'),
      'PressStart2P-Regular': require('../../../public/Fonts/PressStart2P-Regular.ttf'),
    })
      .catch(() => {})
      .finally(() => {
        if (!alive) return;
        setFontsReady(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!envStatus.ok) {
      setSessionReady(true);
      return;
    }

    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setAuthed(!!data.session);
      setSessionReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthed(!!session);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    initPushSdk();
  }, []);

  useEffect(() => {
    if (!authed) return;
    if (!envStatus.ok) return;

    let cancelled = false;

    const withSession = async (
      fn: (session: Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session']) => Promise<void>
    ) => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      await fn(data.session);
    };

    const register = async (force = false) => {
      await withSession(async (session) => {
        if (!session) return;
        await registerForPushNotifications(session, { force, userId: session.user.id });
      });
    };

    const heartbeat = async (forceRegister = false) => {
      await withSession(async (session) => {
        if (!session) return;
        await updateHeartbeat(session, { userId: session.user.id });
        if (forceRegister) {
          await registerForPushNotifications(session, { force: true, userId: session.user.id });
        }
      });
    };

    const initialTimeout = setTimeout(() => {
      void register(false);
    }, 500);

    const heartbeatInterval = setInterval(() => {
      void heartbeat(false);
    }, 5 * 60 * 1000);

    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void heartbeat(true);
      }
    });

    return () => {
      cancelled = true;
      clearTimeout(initialTimeout);
      clearInterval(heartbeatInterval);
      appStateSub.remove();
    };
  }, [authed]);

  useEffect(() => {
    if (authed) return;
    resetPushSessionState();
  }, [authed]);

  if (!fontsReady || !sessionReady) return null;

  return (
    <ThemeProvider tokens={themeTokens}>
      <PersistQueryClientProvider client={queryClient} persistOptions={{ persister: queryPersister }}>
        {!envStatus.ok ? (
          <Screen>
            <TotlText variant="heading" style={{ marginBottom: 12 }}>
              Setup needed
            </TotlText>
            <TotlText variant="muted" style={{ marginBottom: 12 }}>
              Missing config for Supabase. This usually happens if the dev client was installed before the env values were
              embedded.
            </TotlText>
            <Card style={{ marginBottom: 12 }}>
              <TotlText variant="muted">{envStatus.message}</TotlText>
            </Card>
            <TotlText variant="muted" style={{ marginBottom: 12 }}>
              Fix: close the app and reopen it. If it still happens, we'll rebuild the iOS dev client.
            </TotlText>
            <Button title="Close and reopen the app" onPress={() => {}} variant="secondary" />
          </Screen>
        ) : authed ? (
          <ConfettiProvider>
            <LeagueUnreadCountsProvider>
              <AppNavigator />
            </LeagueUnreadCountsProvider>
          </ConfettiProvider>
        ) : (
          <AuthScreen />
        )}
      </PersistQueryClientProvider>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}

export default function AppRoot() {
  return (
    <SafeAreaProvider>
      <ThemePreferenceProvider>
        <AppInner />
      </ThemePreferenceProvider>
    </SafeAreaProvider>
  );
}
