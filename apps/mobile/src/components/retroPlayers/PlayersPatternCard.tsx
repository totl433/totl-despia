import React from 'react';
import { Image, StyleSheet, View, type ViewStyle } from 'react-native';

import { PLAYERS_CARD } from './playersTheme';

const TILE_GREEN = require('../../../assets/players/players-tile-green.png');
const TILE_LIGHT = require('../../../assets/players/players-tile-light.png');

/** Tiled field, big enough to cover the largest card after shifting by the design's grid offset. */
const TILE_FIELD = { width: 640, height: 820 };

export type PlayersPatternVariant = 'green' | 'light';

/**
 * The Players card surface: the football tile pattern, either tinted brand green
 * (intro / countdown) or washed out to near-white (questions / results).
 * The tiles are pre-tinted PNGs so no runtime blend modes are needed.
 */
export default function PlayersPatternCard({
  variant,
  children,
  style,
}: {
  variant: PlayersPatternVariant;
  children?: React.ReactNode;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.shadow, style]}>
      <View style={styles.clip}>
        <Image
          source={variant === 'green' ? TILE_GREEN : TILE_LIGHT}
          resizeMode="repeat"
          style={{
            position: 'absolute',
            left: PLAYERS_CARD.tileOffset.x,
            top: PLAYERS_CARD.tileOffset.y,
            // Explicit size: a required asset's intrinsic size would otherwise win over right/bottom.
            width: TILE_FIELD.width,
            height: TILE_FIELD.height,
          }}
        />
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: PLAYERS_CARD.radius,
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  clip: {
    flex: 1,
    borderRadius: PLAYERS_CARD.radius,
    overflow: 'hidden',
  },
});
