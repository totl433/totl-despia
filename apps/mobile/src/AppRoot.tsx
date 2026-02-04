import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { Button, Card, Screen, ThemeProvider, TotlText } from '@totl/ui';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Font from 'expo-font';

import { queryClient, queryPersister } from './lib/queryClient';
import { initSentry } from './lib/sentry';
import { supabase } from './lib/supabase';
import { registerForPushNotifications } from './lib/push';
import { ConfettiProvider } from './lib/confetti';
import { envStatus } from './env';
import AuthScreen from './screens/AuthScreen';
import AppNavigator from './navigation/AppNavigator';

export default function AppRoot() {
  const [fontsReady, setFontsReady] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  // Force light mode for the Expo app by overriding UI tokens.
  // (Expo config already sets `userInterfaceStyle: "light"`, but our UI tokens were dark by default.)
  const lightThemeTokens = React.useMemo(
    () => ({
      color: {
        background: '#F8FAFC',
        surface: '#FFFFFF',
        surface2: '#E2E8F0',
        text: '#0F172A',
        muted: '#475569',
        border: 'rgba(15,23,42,0.12)',
      },
    }),
    []
  );

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
      'PressStart2P-Regular': require('../../../public/Fonts/PressStart2P-Regular.ttf'),
    })
      .catch(() => {
        // If fonts fail to load, keep going with system fonts.
      })
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
    if (!authed) return;
    if (!envStatus.ok) return;
    registerForPushNotifications().catch(() => {
      // Non-fatal in v1: token registration is best-effort.
    });
  }, [authed]);

  if (!fontsReady || !sessionReady) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider tokens={lightThemeTokens}>
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
                Fix: close the app and reopen it. If it still happens, we’ll rebuild the iOS dev client.
              </TotlText>
              <Button title="Close and reopen the app" onPress={() => {}} variant="secondary" />
            </Screen>
          ) : authed ? (
            <ConfettiProvider>
              <AppNavigator />
            </ConfettiProvider>
          ) : (
            <AuthScreen />
          )}
        </PersistQueryClientProvider>
        <StatusBar style="dark" />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

