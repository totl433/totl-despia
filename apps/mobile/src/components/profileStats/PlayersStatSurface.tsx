import React from 'react';
import { StyleSheet, View } from 'react-native';

import { PLAYERS_COLORS } from '../retroPlayers/playersTheme';

/** Quiz navy behind the patterned stats cards. */
export default function PlayersStatSurface() {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, styles.base]} />
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: PLAYERS_COLORS.navy,
  },
});
