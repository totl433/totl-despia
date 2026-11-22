import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";

import RetroTotlDailyPlayersScreen from "../screens/retroPlayers/RetroTotlDailyPlayersScreen";
import RetroPlayersScoreboardScreen from "../screens/retroPlayers/RetroPlayersScoreboardScreen";
import PlayersShootoutHomeScreen from "../screens/retroPlayers/PlayersShootoutHomeScreen";
import PlayersShootoutPickScreen from "../screens/retroPlayers/PlayersShootoutPickScreen";
import PlayersShootoutMatchScreen from "../screens/retroPlayers/PlayersShootoutMatchScreen";
import PlayersShootoutHistoryScreen from "../screens/retroPlayers/PlayersShootoutHistoryScreen";

export type RetroTotlDailyPlayersStackParamList = {
  RetroTotlDailyPlayersPlay: undefined;
  RetroTotlDailyPlayersScoreboard: undefined;
  /** Shootout: rules card, your challenges, Challenge someone. */
  /** `sandbox`: admin test mode against Test Bot, in memory only. */
  PlayersShootoutHome: { sandbox?: boolean } | undefined;
  /** Shootout: pick who to challenge. */
  PlayersShootoutPick: { sandbox?: boolean } | undefined;
  /** Shootout: one challenge, and playing your card. */
  PlayersShootoutMatch: { id: string; sandbox?: boolean };
  /** Shootout: every finished one. */
  PlayersShootoutHistory: { sandbox?: boolean } | undefined;
};

const Stack = createNativeStackNavigator<RetroTotlDailyPlayersStackParamList>();

/** Nested stack so Scoreboard and Shootout are full pages inside The Players modal flow. */
export default function RetroTotlDailyPlayersNavigator() {
  return (
    // Its own sheet host: the flow is a native full-screen modal, and sheets hosted at the
    // app root open behind it (the Rules sheets).
    <BottomSheetModalProvider>
      <Stack.Navigator
        screenOptions={{ headerShown: false, animation: "slide_from_right" }}
      >
        <Stack.Screen
          name="RetroTotlDailyPlayersPlay"
          component={RetroTotlDailyPlayersScreen}
        />
        <Stack.Screen
          name="RetroTotlDailyPlayersScoreboard"
          component={RetroPlayersScoreboardScreen}
        />
        <Stack.Screen
          name="PlayersShootoutHome"
          component={PlayersShootoutHomeScreen}
        />
        <Stack.Screen
          name="PlayersShootoutPick"
          component={PlayersShootoutPickScreen}
        />
        <Stack.Screen
          name="PlayersShootoutHistory"
          component={PlayersShootoutHistoryScreen}
        />
        <Stack.Screen
          name="PlayersShootoutMatch"
          component={PlayersShootoutMatchScreen}
          // A swipe back mid-card would leave the 10 seconds running.
          options={{ gestureEnabled: false }}
        />
      </Stack.Navigator>
    </BottomSheetModalProvider>
  );
}
