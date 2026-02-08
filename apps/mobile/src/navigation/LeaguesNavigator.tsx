import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTokens } from '@totl/ui';

import LeaguesScreen from '../screens/LeaguesScreen';

export type LeaguesStackParamList = {
  LeaguesList: undefined;
};

const Stack = createNativeStackNavigator<LeaguesStackParamList>();

export default function LeaguesNavigator() {
  const t = useTokens();
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: t.color.background },
      }}
    >
      <Stack.Screen name="LeaguesList" component={LeaguesScreen} />
    </Stack.Navigator>
  );
}

