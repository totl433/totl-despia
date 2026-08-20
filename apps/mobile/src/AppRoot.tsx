import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { Button, Card, Screen, ThemeProvider, TotlText } from '@totl/ui';
import { AppState, Linking, LogBox } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Font from 'expo-font';

LogBox.ignoreLogs([
  '[RevenueCat]',
  'RevenueCat',
]);

import { queryClient, queryPersister } from './lib/queryClient';
import { initSentry } from './lib/sentry';
import { supabase } from './lib/supabase';
import { consumeAuthCallbackUrl } from './lib/authCallback';
import { initPushSdk, registerForPushNotifications, resetPushSessionState, updateHeartbeat } from './lib/push';
import { configurePurchases, loginPurchases, logoutPurchases } from './lib/purchases';
import { ConfettiProvider } from './lib/confetti';
import { LeagueUnreadCountsProvider } from './context/LeagueUnreadCountsContext';
import { JoinIntentProvider } from './context/JoinIntentContext';
import { DeepLinkProvider } from './context/DeepLinkContext';
import { ThemePreferenceProvider, useThemePreference } from './context/ThemePreferenceContext';
import { envStatus } from './env';
import AuthScreen from './screens/AuthScreen';
import ChooseUsernameScreen from './screens/ChooseUsernameScreen';
import AppNavigator from './navigation/AppNavigator';
import { resolveProfileStatus } from './lib/userProfile';
import PopupCardsProvider from './components/popupCards/PopupCardsProvider';
import { lightThemeTokens } from './lib/lightThemeTokens';

export default function AppRoot() {
  const [fontsReady, setFontsReady] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);

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
    const handleAuthUrl = (url: string | null) => {
      if (!alive || !url) return;
      void consumeAuthCallbackUrl(url).catch((error) => {
        console.error('[AppRoot] Auth callback failed:', error);
      });
    };
    void Linking.getInitialURL().then(handleAuthUrl);
    const linkSub = Linking.addEventListener('url', ({ url }) => handleAuthUrl(url));

    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setAuthed(!!data.session);
      setSessionUserId(data.session?.user?.id ?? null);
      setSessionReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthed(!!session);
      setSessionUserId(session?.user?.id ?? null);
    });
    return () => {
      alive = false;
      linkSub.remove();
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
    if (!sessionReady) return;
    if (authed) return;
    resetPushSessionState();
    void logoutPurchases();
  }, [authed, sessionReady]);

  useEffect(() => {
    if (!sessionReady) return;
    if (!authed) return;
    let cancelled = false;
    (async () => {
      const userId = sessionUserId;
      if (!userId || cancelled) return;
      await configurePurchases(userId);
      if (cancelled) return;
      await loginPurchases(userId);
    })();
    return () => {
      cancelled = true;
    };
  }, [authed, sessionReady, sessionUserId]);

  if (!fontsReady || !sessionReady) return null;

  return (
    <SafeAreaProvider>
      <DeepLinkProvider>
        <ThemePreferenceProvider>
          <ThemedApp authed={authed} />
        </ThemePreferenceProvider>
      </DeepLinkProvider>
    </SafeAreaProvider>
  );
}

function ThemedApp({ authed }: { authed: boolean }) {
  const { isDark } = useThemePreference();
  const [profileReady, setProfileReady] = useState(!authed);
  const [needsUsername, setNeedsUsername] = useState(false);

  useEffect(() => {
    if (!authed) {
      setNeedsUsername(false);
      setProfileReady(true);
      return;
    }

    let alive = true;
    setProfileReady(false);
    supabase.auth
      .getUser()
      .then(async ({ data }) => {
        const userId = data.user?.id;
        if (!userId) {
          if (alive) {
            setNeedsUsername(false);
            setProfileReady(true);
          }
          return;
        }
        const status = await resolveProfileStatus(userId);
        if (!alive) return;
        setNeedsUsername(status === 'needs-username');
        setProfileReady(true);
      })
      .catch(() => {
        if (!alive) return;
        setNeedsUsername(true);
        setProfileReady(true);
      });

    return () => {
      alive = false;
    };
  }, [authed]);

  return (
    <ThemeProvider tokens={isDark ? undefined : lightThemeTokens}>
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
        ) : authed && !profileReady ? null : authed && needsUsername ? (
          <ChooseUsernameScreen onComplete={() => setNeedsUsername(false)} />
        ) : authed ? (
          <JoinIntentProvider>
            <ConfettiProvider>
              <LeagueUnreadCountsProvider>
                <PopupCardsProvider>
                  <AppNavigator />
                </PopupCardsProvider>
              </LeagueUnreadCountsProvider>
            </ConfettiProvider>
          </JoinIntentProvider>
        ) : (
          <AuthScreen />
        )}
      </PersistQueryClientProvider>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}

