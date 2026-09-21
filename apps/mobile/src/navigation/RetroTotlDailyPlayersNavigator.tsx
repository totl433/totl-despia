import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import RetroTotlDailyPlayersScreen from '../screens/retroPlayers/RetroTotlDailyPlayersScreen';
import RetroPlayersScoreboardScreen from '../screens/retroPlayers/RetroPlayersScoreboardScreen';

export type RetroTotlDailyPlayersStackParamList = {
  RetroTotlDailyPlayersPlay: undefined;
  RetroTotlDailyPlayersScoreboard: undefined;
};

const Stack = createNativeStackNavigator<RetroTotlDailyPlayersStackParamList>();

/** Nested stack so Scoreboard is a full page inside The Players modal flow. */
export default function RetroTotlDailyPlayersNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="RetroTotlDailyPlayersPlay" component={RetroTotlDailyPlayersScreen} />
      <Stack.Screen name="RetroTotlDailyPlayersScoreboard" component={RetroPlayersScoreboardScreen} />
    </Stack.Navigator>
  );
}
