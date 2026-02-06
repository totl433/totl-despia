import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import HomeScreen from '../screens/HomeScreen';
import PredictionsScreen from '../screens/PredictionsScreen';
import GlobalScreen from '../screens/GlobalScreen';
import LeaguesNavigator from './LeaguesNavigator';
import FloatingTabBar from './FloatingTabBar';
import ProfileNavigator from './ProfileNavigator';

export type RootTabsParamList = {
  Home: undefined;
  Predictions: undefined;
  Leagues: undefined;
  Global: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<RootTabsParamList>();

export default function TabsNavigator() {
  return (
    <Tab.Navigator
      tabBar={(props) => {
        const active = props.state.routes[props.state.index];
        const options = active ? props.descriptors[active.key]?.options : undefined;
        const tabBarStyle = options?.tabBarStyle as Record<string, unknown> | undefined;
        const hide = tabBarStyle?.display === 'none';
        if (hide) return null;
        return <FloatingTabBar {...props} />;
      }}
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
        },
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Predictions" component={PredictionsScreen} />
      <Tab.Screen name="Leagues" component={LeaguesNavigator as any} />
      <Tab.Screen name="Global" component={GlobalScreen} />
      <Tab.Screen
        name="Profile"
        component={ProfileNavigator}
        options={{
          // Keep route available for header buttons, but hide it from the 4-button web-style nav.
          tabBarButton: () => null,
        }}
      />
    </Tab.Navigator>
  );
}

