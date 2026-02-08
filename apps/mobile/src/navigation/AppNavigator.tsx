import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DarkTheme, NavigationContainer, createNavigationContainerRef, type Theme } from '@react-navigation/native';
import { Linking } from 'react-native';
import { useTokens } from '@totl/ui';

import TabsNavigator from './TabsNavigator';
import GameweekResultsModalScreen from '../screens/GameweekResultsModalScreen';
import { supabase } from '../lib/supabase';
import LeagueDetailScreen from '../screens/LeagueDetailScreen';
import LeagueChatScreen from '../screens/LeagueChatScreen';
import CreateLeagueScreen from '../screens/CreateLeagueScreen';
import ChatThreadScreen from '../screens/ChatThreadScreen';
import ProfileNavigator from './ProfileNavigator';

export type RootStackParamList = {
  Tabs: undefined;
  LeagueDetail: { leagueId: string; name: string };
  LeagueChat: { leagueId: string; name: string };
  CreateLeague: undefined;
  ChatThread: { leagueId: string; name: string };
  Profile: undefined;
  GameweekResults: { gw: number };
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const navigationRef = createNavigationContainerRef<RootStackParamList>();

export default function AppNavigator() {
  const t = useTokens();
  const pendingUrlRef = React.useRef<string | null>(null);

  const handleIncomingUrl = React.useCallback(async (url: string) => {
    if (!url) return;

    // Route: /leagues
    if (/\/leagues(?:[/?#]|$)/i.test(url)) {
      if (!navigationRef.isReady()) {
        pendingUrlRef.current = url;
        return;
      }
      navigationRef.navigate('Tabs' as any, { screen: 'Leagues' } as any);
      return;
    }

    // Route: /league/{CODE}[?tab=chat] or /league/{CODE}/chat
    const m = url.match(/\/league\/([^/?#]+)/i);
    if (!m?.[1]) return;
    const raw = decodeURIComponent(m[1]);
    const code = String(raw).trim().toUpperCase();
    if (!code) return;

    const openChat = /tab=chat/i.test(url) || /\/league\/[^/?#]+\/chat(?:[/?#]|$)/i.test(url);

    // Resolve league ID from code (native screens are keyed by leagueId).
    try {
      const { data: league } = await (supabase as any)
        .from('leagues')
        .select('id, name')
        .eq('code', code)
        .maybeSingle();

      const leagueId = league?.id ? String(league.id) : null;
      const name = league?.name ? String(league.name) : code;
      if (!leagueId) return;

      if (!navigationRef.isReady()) {
        pendingUrlRef.current = url;
        return;
      }

      if (openChat) {
        navigationRef.navigate('ChatThread', { leagueId, name });
      } else {
        navigationRef.navigate('LeagueDetail', { leagueId, name });
      }
    } catch {
      // ignore
    }
  }, []);

  React.useEffect(() => {
    // Handle initial URL (cold start) and subsequent incoming URLs.
    Linking.getInitialURL()
      .then((u) => {
        if (u) void handleIncomingUrl(u);
      })
      .catch(() => {});

    const sub = Linking.addEventListener('url', ({ url }) => {
      void handleIncomingUrl(url);
    });
    return () => sub.remove();
  }, [handleIncomingUrl]);

  const navTheme: Theme = {
    ...DarkTheme,
    dark: true,
    colors: {
      ...DarkTheme.colors,
      primary: t.color.brand,
      background: t.color.background,
      card: t.color.surface,
      text: t.color.text,
      border: t.color.border,
      notification: t.color.brand,
    },
  };

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={navTheme}
      onReady={() => {
        const pending = pendingUrlRef.current;
        if (!pending) return;
        pendingUrlRef.current = null;
        void handleIncomingUrl(pending);
      }}
    >
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: t.color.background },
        }}
      >
        <Stack.Screen name="Tabs" component={TabsNavigator} />
        <Stack.Screen name="LeagueDetail" component={LeagueDetailScreen} />
        <Stack.Screen name="LeagueChat" component={LeagueChatScreen} />
        <Stack.Screen name="CreateLeague" component={CreateLeagueScreen} />
        <Stack.Screen name="ChatThread" component={ChatThreadScreen} />
        <Stack.Screen name="Profile" component={ProfileNavigator} />
        <Stack.Screen
          name="GameweekResults"
          component={GameweekResultsModalScreen}
          options={{
            presentation: 'fullScreenModal',
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

