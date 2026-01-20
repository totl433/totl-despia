import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';

import HomeScreen from '../screens/HomeScreen';
import PredictionsScreen from '../screens/PredictionsScreen';
import GlobalScreen from '../screens/GlobalScreen';
import ProfileScreen from '../screens/ProfileScreen';
import LeaguesNavigator from './LeaguesNavigator';

export type RootTabsParamList = {
  Home: undefined;
  Predictions: undefined;
  Leagues: undefined;
  Global: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<RootTabsParamList>();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Tab.Navigator screenOptions={{ headerShown: false }}>
        <Tab.Screen name="Home" component={HomeScreen} />
        <Tab.Screen name="Predictions" component={PredictionsScreen} />
        <Tab.Screen name="Leagues" component={LeaguesNavigator as any} />
        <Tab.Screen name="Global" component={GlobalScreen} />
        <Tab.Screen name="Profile" component={ProfileScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

