import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTokens } from '@totl/ui';

import HomeScreen from '../screens/HomeScreen';
import MatchCenterScreen from '../screens/MatchCenterScreen';

export type MatchCenterEntry = 'current' | 'last' | 'example';

export type HomeStackParamList = {
  HomeMain: undefined;
  MatchCenter: { entry?: MatchCenterEntry } | undefined;
};

const Stack = createNativeStackNavigator<HomeStackParamList>();

export default function HomeNavigator() {
  const t = useTokens();
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: t.color.background },
      }}
    >
      <Stack.Screen name="HomeMain" component={HomeScreen} />
      <Stack.Screen name="MatchCenter" component={MatchCenterScreen} />
    </Stack.Navigator>
  );
}
