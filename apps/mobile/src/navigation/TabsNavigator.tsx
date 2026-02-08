import React from 'react';
import { createNativeBottomTabNavigator } from '@bottom-tabs/react-navigation';
import { useTokens } from '@totl/ui';

import HomeScreen from '../screens/HomeScreen';
import PredictionsScreen from '../screens/PredictionsScreen';
import GlobalScreen from '../screens/GlobalScreen';
import LeaguesNavigator from './LeaguesNavigator';
import ChatNavigator from './ChatNavigator';
import { useLeagueUnreadCounts } from '../hooks/useLeagueUnreadCounts';

export type RootTabsParamList = {
  Home: undefined;
  Predictions: undefined;
  Leagues: undefined;
  Chat: undefined;
  Global: undefined;
};

const Tab = createNativeBottomTabNavigator<RootTabsParamList>();

export default function TabsNavigator() {
  const t = useTokens();
  const { unreadByLeagueId } = useLeagueUnreadCounts();
  const hasAnyUnread = React.useMemo(
    () => Object.values(unreadByLeagueId ?? {}).some((n) => Number(n ?? 0) > 0),
    [unreadByLeagueId]
  );

  return (
    <Tab.Navigator
      tabBarActiveTintColor={t.color.brand}
      tabBarInactiveTintColor={'#353536'}
      labeled
      tabBarStyle={{ backgroundColor: t.color.surface }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: 'Home',
          tabBarIcon: () => require('../../../../public/assets/Icons/bottomnav_home.svg'),
        }}
      />
      <Tab.Screen
        name="Predictions"
        component={PredictionsScreen}
        options={{
          title: 'Predictions',
          tabBarIcon: () => require('../../../../public/assets/Icons/bottomnav_predictions.svg'),
        }}
      />
      <Tab.Screen
        name="Leagues"
        component={LeaguesNavigator as any}
        options={{
          title: 'Mini Leagues',
          tabBarIcon: () => require('../../../../public/assets/Icons/bottomnav_mini-leagues.svg'),
        }}
      />
      <Tab.Screen
        name="Chat"
        component={ChatNavigator as any}
        options={{
          title: 'Chat',
          tabBarIcon: () => require('../../../../public/assets/Icons/bottomnav_chat.svg'),
          // Dot-only badge: native bottom tabs require a space string.
          tabBarBadge: hasAnyUnread ? ' ' : undefined,
          tabBarBadgeBackgroundColor: '#DC2626',
        }}
      />
      <Tab.Screen
        name="Global"
        component={GlobalScreen}
        options={{
          title: 'Leaderboards',
          tabBarIcon: () => require('../../../../public/assets/Icons/bottomnav_leaderboards.svg'),
        }}
      />
    </Tab.Navigator>
  );
}

