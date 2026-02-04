import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

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

export default function TabsNavigator() {
  return (
    <Tab.Navigator
      tabBar={(props) => {
        const activeRouteName = props.state.routes[props.state.index]?.name;
        if (activeRouteName === 'Predictions') return null;
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
        component={ProfileScreen}
        options={{
          // Keep route available for header buttons, but hide it from the 4-button web-style nav.
          tabBarButton: () => null,
        }}
      />
    </Tab.Navigator>
  );
}

