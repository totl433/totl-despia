import React from 'react';
import { Image, StyleSheet, View, type ViewStyle } from 'react-native';

import { PLAYERS_CARD } from './playersTheme';

const TILE_GREEN = require('../../../assets/players/players-tile-green.png');
const TILE_LIGHT = require('../../../assets/players/players-tile-light.png');

/** Tiled field, big enough to cover the largest card after shifting by the design's grid offset. */
const TILE_FIELD = { width: 640, height: 820 };

export type PlayersPatternVariant = 'green' | 'light';

/** Base colour of each tile, shown if the image is a frame late (no white flash on remount). */
const TILE_BASE: Record<PlayersPatternVariant, string> = { green: '#03362C', light: '#FAFAFA' };

/**
 * The Players card surface: the football tile pattern, either tinted brand green
 * (intro / countdown) or washed out to near-white (questions / results).
 * The tiles are pre-tinted PNGs so no runtime blend modes are needed.
 */
export default function PlayersPatternCard({
  variant,
  children,
  style,
  layout = 'fill',
}: {
  variant: PlayersPatternVariant;
  children?: React.ReactNode;
  style?: ViewStyle;
  /** `fill` sits in a sized parent (quiz card). `hug` sizes to children (stats cards). */
  layout?: 'fill' | 'hug';
}) {
  const hug = layout === 'hug';
  return (
    <View style={[hug ? styles.shadowHug : styles.shadow, style]}>
      <View style={[styles.clip, hug ? styles.clipHug : null, { backgroundColor: TILE_BASE[variant] }]}>
        <Image
          source={variant === 'green' ? TILE_GREEN : TILE_LIGHT}
          resizeMode="repeat"
          fadeDuration={0}
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
  shadowHug: {
    borderRadius: 16,
    shadowColor: '#0F172A',
    shadowOpacity: 0.07,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  clip: {
    flex: 1,
    borderRadius: PLAYERS_CARD.radius,
    overflow: 'hidden',
  },
  clipHug: {
    flexGrow: 1,
    flexShrink: 0,
    flexBasis: 'auto',
    borderRadius: 16,
  },
});
