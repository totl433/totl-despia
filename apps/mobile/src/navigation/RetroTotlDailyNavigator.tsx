import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import RetroTotlDailyScreen from '../screens/retroDaily/RetroTotlDailyScreen';
import RetroDailyScoreboardScreen from '../screens/retroDaily/RetroDailyScoreboardScreen';

export type RetroTotlDailyStackParamList = {
  RetroTotlDailyPlay: undefined;
  RetroTotlDailyScoreboard: undefined;
};

const Stack = createNativeStackNavigator<RetroTotlDailyStackParamList>();

/**
 * Nested stack so Scoreboard is a full page inside the RTD modal flow.
 */
export default function RetroTotlDailyNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="RetroTotlDailyPlay" component={RetroTotlDailyScreen} />
      <Stack.Screen name="RetroTotlDailyScoreboard" component={RetroDailyScoreboardScreen} />
    </Stack.Navigator>
  );
}
