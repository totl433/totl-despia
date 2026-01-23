import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DarkTheme, NavigationContainer, type Theme } from '@react-navigation/native';
import { useTokens } from '@totl/ui';

import HomeScreen from '../screens/HomeScreen';
import PredictionsScreen from '../screens/PredictionsScreen';
import GlobalScreen from '../screens/GlobalScreen';
import ProfileScreen from '../screens/ProfileScreen';
import LeaguesNavigator from './LeaguesNavigator';
import FloatingTabBar from './FloatingTabBar';

export type RootTabsParamList = {
  Home: undefined;
  Predictions: undefined;
  Leagues: undefined;
  Global: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<RootTabsParamList>();

export default function AppNavigator() {
  const t = useTokens();

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
    <NavigationContainer theme={navTheme}>
      <Tab.Navigator
        tabBar={(props) => <FloatingTabBar {...props} />}
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
          component={ProfileScreen}
          options={{
            // Keep route available for header buttons, but hide it from the 4-button web-style nav.
            tabBarButton: () => null,
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

