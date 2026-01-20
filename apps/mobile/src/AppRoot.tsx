import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { ThemeProvider } from '@totl/ui';

import { queryClient, queryPersister } from './lib/queryClient';
import { initSentry } from './lib/sentry';
import { supabase } from './lib/supabase';
import { registerForPushNotifications } from './lib/push';
import AuthScreen from './screens/AuthScreen';
import AppNavigator from './navigation/AppNavigator';

export default function AppRoot() {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    initSentry();
  }, []);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setAuthed(!!data.session);
      setReady(true);
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
    registerForPushNotifications().catch(() => {
      // Non-fatal in v1: token registration is best-effort.
    });
  }, [authed]);

  if (!ready) return null;

  return (
    <ThemeProvider>
      <PersistQueryClientProvider client={queryClient} persistOptions={{ persister: queryPersister }}>
        {authed ? <AppNavigator /> : <AuthScreen />}
      </PersistQueryClientProvider>
      <StatusBar style="light" />
    </ThemeProvider>
  );
}

