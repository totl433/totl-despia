import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DarkTheme, DefaultTheme, NavigationContainer, createNavigationContainerRef, type Theme } from '@react-navigation/native';
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
import JoinMiniLeagueScreen from '../screens/JoinMiniLeagueScreen';
import { useDeepLink } from '../context/DeepLinkContext';
import { resolveDeepLinkTarget } from '../lib/deepLinks';
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
  BrandedLeaderboard: { idOrSlug: string; joinCode?: string; initialTab?: 'leaderboard' | 'broadcast' };
  BrandedLeaderboardList: undefined;
  JoinLeaderboard: { leaderboardId?: string; leaderboardName?: string; code?: string };
  JoinMiniLeague: { code: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export default function AppNavigator() {
  const t = useTokens();
  const { isDark } = useThemePreference();
  const { pending: joinIntent, clearPending: clearJoinIntent } = useJoinIntent();
  const { pendingUrl, consumePendingUrl } = useDeepLink();
  const processingUrlRef = React.useRef<string | null>(null);
  const joinIntentConsumedRef = React.useRef(false);

  const handleIncomingUrl = React.useCallback(async (url: string): Promise<boolean> => {
    if (!url || !navigationRef.isReady()) return false;
    const target = resolveDeepLinkTarget(url);
    if (!target) return true;

    if (target.type === 'join') {
      navigationRef.navigate('JoinLeaderboard' as any, { code: target.code });
      return true;
    }
    if (target.type === 'miniLeagueInvite') {
      navigationRef.navigate('JoinMiniLeague', { code: target.code });
      return true;
    }
    if (target.type === 'leagues') {
      navigationRef.navigate('Tabs' as any, { screen: 'Leagues' } as any);
      return true;
    }
    if (target.type === 'predictions') {
      navigationRef.navigate('Tabs' as any, { screen: 'Predictions' } as any);
      return true;
    }
    if (target.type === 'brandedLeaderboard') {
      navigationRef.navigate('BrandedLeaderboard', {
        idOrSlug: target.idOrSlug,
        initialTab: target.initialTab,
      });
      return true;
    }

    const openMiniLeagueJoin = () => {
      navigationRef.navigate(
        'Tabs' as any,
        {
          screen: 'Leagues',
          params: {
            screen: 'LeaguesList',
            params: { openCreateJoin: true, joinCode: target.code },
          },
        } as any
      );
    };

    // League URLs carry the public code; native screens are keyed by league ID.
    try {
      const { data: league } = await (supabase as any)
        .from('leagues')
        .select('id, name')
        .eq('code', target.code)
        .maybeSingle();

      const leagueId = league?.id ? String(league.id) : null;
      const name = league?.name ? String(league.name) : target.code;
      if (!leagueId || !navigationRef.isReady()) {
        openMiniLeagueJoin();
        return true;
      }

      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id;
      if (userId) {
        const membership = await (supabase as any)
          .from('league_members')
          .select('league_id')
          .eq('league_id', leagueId)
          .eq('user_id', userId)
          .maybeSingle();
        if (!membership.error && !membership.data) {
          openMiniLeagueJoin();
          return true;
        }
      }

      if (target.openChat) {
        navigationRef.navigate('Chat2Thread', { leagueId, name });
      } else {
        navigationRef.navigate(
          'LeagueDetail',
          target.initialTab ? { leagueId, name, initialTab: target.initialTab } : { leagueId, name }
        );
      }
    } catch {
      // Preserve the destination and let the join UI provide a useful error.
      if (navigationRef.isReady()) openMiniLeagueJoin();
    }
    return true;
  }, []);

  const processPendingUrl = React.useCallback(async () => {
    if (!pendingUrl || !navigationRef.isReady() || processingUrlRef.current === pendingUrl) return;
    processingUrlRef.current = pendingUrl;
    const handled = await handleIncomingUrl(pendingUrl);
    if (handled) consumePendingUrl(pendingUrl);
    processingUrlRef.current = null;
  }, [consumePendingUrl, handleIncomingUrl, pendingUrl]);

  React.useEffect(() => {
    void processPendingUrl();
  }, [processPendingUrl]);

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
        if (pendingUrl) {
          void processPendingUrl();
        } else if (joinIntent && !joinIntentConsumedRef.current) {
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
          name="JoinMiniLeague"
          component={JoinMiniLeagueScreen}
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

