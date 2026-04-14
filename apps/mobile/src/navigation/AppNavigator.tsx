import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DarkTheme, DefaultTheme, NavigationContainer, createNavigationContainerRef, type Theme } from '@react-navigation/native';
import { Linking } from 'react-native';
import { useTokens } from '@totl/ui';

import TabsNavigator from './TabsNavigator';
import GameweekResultsModalScreen from '../screens/GameweekResultsModalScreen';
import { supabase } from '../lib/supabase';
import LeagueDetailScreen from '../screens/LeagueDetailScreen';
import LeagueChatScreen from '../screens/LeagueChatScreen';
import CreateLeagueScreen from '../screens/CreateLeagueScreen';
import ChatThreadScreen from '../screens/ChatThreadScreen';
import Chat2ThreadScreen from '../screens/Chat2ThreadScreen';
import ProfileNavigator from './ProfileNavigator';
import PredictionsScreen from '../screens/PredictionsScreen';
import Chat2Navigator from './Chat2Navigator';
import { useThemePreference } from '../context/ThemePreferenceContext';
import { useJoinIntent } from '../context/JoinIntentContext';
import BrandedLeaderboardScreen from '../screens/brandedLeaderboards/BrandedLeaderboardScreen';
import BrandedLeaderboardListScreen from '../screens/brandedLeaderboards/BrandedLeaderboardListScreen';
import JoinLeaderboardScreen from '../screens/brandedLeaderboards/JoinLeaderboardScreen';
export type RootStackParamList = {
  Tabs: undefined;
  LeagueDetail: { leagueId: string; name: string; returnTo?: 'chat' | 'chat2'; chatMlHopCount?: number; initialTab?: 'gwTable' | 'predictions' | 'season' };
  LeagueChat: { leagueId: string; name: string };
  CreateLeague: undefined;
  ChatThread: { leagueId: string; name: string };
  Chat2Thread: { leagueId: string; name: string; chatMlHopCount?: number };
  ChatHub: undefined;
  Profile: undefined;
  PredictionsFlow: undefined;
  PredictionsTestFlow: undefined;
  GameweekResults: { gw: number; mode?: 'roundup' | 'fixturesShare' };
  BrandedLeaderboard: { idOrSlug: string; joinCode?: string };
  BrandedLeaderboardList: undefined;
  JoinLeaderboard: { leaderboardId?: string; leaderboardName?: string; code?: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const navigationRef = createNavigationContainerRef<RootStackParamList>();
type LeagueInitialTab = NonNullable<RootStackParamList['LeagueDetail']['initialTab']>;

function parseIncomingUrl(rawUrl: string): URL | null {
  try {
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(rawUrl)) {
      return new URL(rawUrl);
    }
    if (rawUrl.startsWith('/')) {
      return new URL(`https://totl.local${rawUrl}`);
    }
  } catch {
    // Ignore invalid URLs and fall back to regex matching below.
  }
  return null;
}

function getLeagueTarget(rawUrl: string): { code: string; openChat: boolean; initialTab?: LeagueInitialTab } | null {
  const parsed = parseIncomingUrl(rawUrl);
  const pathname = parsed?.pathname ?? rawUrl;
  const pathLeagueMatch = pathname.match(/\/league\/([^/?#]+)/i);
  const queryLeagueCode = parsed?.searchParams.get('leagueCode');
  const rawCode = pathLeagueMatch?.[1] ?? queryLeagueCode ?? '';
  const code = decodeURIComponent(String(rawCode)).trim().toUpperCase();
  if (!code) return null;

  const tabParam = (parsed?.searchParams.get('tab') ?? '').trim().toLowerCase();
  const openChat = tabParam === 'chat' || /\/league\/[^/?#]+\/chat(?:[/?#]|$)/i.test(pathname);

  let initialTab: LeagueInitialTab | undefined;
  if (!openChat) {
    if (tabParam === 'predictions') {
      initialTab = 'predictions';
    } else if (tabParam === 'season') {
      initialTab = 'season';
    } else if (tabParam === 'gw' || tabParam === 'gwtable' || tabParam === 'table') {
      initialTab = 'gwTable';
    }
  }

  return { code, openChat, initialTab };
}

export default function AppNavigator() {
  const t = useTokens();
  const { isDark } = useThemePreference();
  const { pending: joinIntent, clearPending: clearJoinIntent } = useJoinIntent();
  const pendingUrlRef = React.useRef<string | null>(null);
  const joinIntentConsumedRef = React.useRef(false);

  const handleIncomingUrl = React.useCallback(async (url: string) => {
    if (!url) return;
    const parsed = parseIncomingUrl(url);
    const pathname = parsed?.pathname ?? url;

    // Route: /join/{code}
    const joinMatch = pathname.match(/\/join\/([^/?#]+)/i);
    if (joinMatch?.[1]) {
      const joinCode = decodeURIComponent(joinMatch[1]).trim().toUpperCase();
      if (joinCode) {
        if (!navigationRef.isReady()) {
          pendingUrlRef.current = url;
          return;
        }
        navigationRef.navigate('JoinLeaderboard' as any, { code: joinCode });
        return;
      }
    }

    // Route: /leagues
    if (/\/leagues(?:[/?#]|$)/i.test(pathname)) {
      if (!navigationRef.isReady()) {
        pendingUrlRef.current = url;
        return;
      }
      navigationRef.navigate('Tabs' as any, { screen: 'Leagues' } as any);
      return;
    }

    // Route: /predictions
    if (/\/predictions(?:[/?#]|$)/i.test(pathname)) {
      if (!navigationRef.isReady()) {
        pendingUrlRef.current = url;
        return;
      }
      navigationRef.navigate('PredictionsFlow');
      return;
    }

    const leagueTarget = getLeagueTarget(url);
    if (!leagueTarget) return;
    const { code, openChat, initialTab } = leagueTarget;

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
        navigationRef.navigate('LeagueDetail', initialTab ? { leagueId, name, initialTab } : { leagueId, name });
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

  const baseTheme = isDark ? DarkTheme : DefaultTheme;
  const navTheme: Theme = {
    ...baseTheme,
    dark: isDark,
    colors: {
      ...baseTheme.colors,
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
        if (pending) {
          pendingUrlRef.current = null;
          void handleIncomingUrl(pending);
        }

        if (joinIntent && !joinIntentConsumedRef.current) {
          joinIntentConsumedRef.current = true;
          clearJoinIntent();
          navigationRef.navigate('JoinLeaderboard' as any, {
            leaderboardId: joinIntent.leaderboardId,
            code: joinIntent.code,
          });
        }
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
        <Stack.Screen
          name="LeagueChat"
          component={LeagueChatScreen}
          options={{
            headerShown: true,
            headerShadowVisible: false,
            headerStyle: { backgroundColor: t.color.background },
            headerTintColor: t.color.text,
            headerTitle: '',
            headerTitleAlign: 'left',
          }}
        />
        <Stack.Screen name="CreateLeague" component={CreateLeagueScreen} />
        <Stack.Screen name="ChatThread" component={ChatThreadScreen} />
        <Stack.Screen
          name="ChatHub"
          component={Chat2Navigator}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="PredictionsFlow"
          component={PredictionsScreen}
          options={{
            presentation: 'fullScreenModal',
          }}
        />
        <Stack.Screen
          name="PredictionsTestFlow"
          component={PredictionsScreen}
          options={{
            presentation: 'fullScreenModal',
          }}
        />
        <Stack.Screen
          name="Chat2Thread"
          component={Chat2ThreadScreen}
          options={{
            headerShown: true,
            headerShadowVisible: false,
            headerStyle: { backgroundColor: t.color.background },
            headerTintColor: t.color.text,
            headerTitle: '',
            headerTitleAlign: 'left',
          }}
        />
        <Stack.Screen name="Profile" component={ProfileNavigator} />
        <Stack.Screen
          name="BrandedLeaderboard"
          component={BrandedLeaderboardScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="BrandedLeaderboardList"
          component={BrandedLeaderboardListScreen}
          options={{
            headerShown: true,
            headerShadowVisible: false,
            headerStyle: { backgroundColor: t.color.background },
            headerTintColor: t.color.text,
            headerTitle: 'Leaderboards',
          }}
        />
        <Stack.Screen
          name="JoinLeaderboard"
          component={JoinLeaderboardScreen}
          options={{
            headerShown: true,
            headerShadowVisible: false,
            headerStyle: { backgroundColor: t.color.background },
            headerTintColor: t.color.text,
            headerTitle: '',
          }}
        />
        <Stack.Screen
          name="GameweekResults"
          component={GameweekResultsModalScreen}
          options={({ route }) => {
            const mode = route.params?.mode;
            if (mode === 'fixturesShare') {
              return {
                presentation: 'transparentModal',
                animation: 'fade',
                contentStyle: { backgroundColor: 'transparent' },
              };
            }
            return {
              presentation: 'fullScreenModal',
            };
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

