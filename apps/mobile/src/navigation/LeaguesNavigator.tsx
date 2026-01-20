import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import LeaguesScreen from '../screens/LeaguesScreen';
import LeagueDetailScreen from '../screens/LeagueDetailScreen';

export type LeaguesStackParamList = {
  LeaguesList: undefined;
  LeagueDetail: { leagueId: string; name: string };
};

const Stack = createNativeStackNavigator<LeaguesStackParamList>();

export default function LeaguesNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="LeaguesList" component={LeaguesScreen} />
      <Stack.Screen name="LeagueDetail" component={LeagueDetailScreen} />
    </Stack.Navigator>
  );
}

