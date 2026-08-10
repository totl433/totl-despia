import React from 'react';
import { Image, type ImageStyle, type StyleProp } from 'react-native';

/**
 * Rank medal — Apple Color Emoji 🏅 rendered as bitmap.
 * Same reliability path as {@link UnicornIcon} (see there for why not pure Text emoji).
 */
export default function MedalIcon({
  size = 14,
  style,
}: {
  size?: number;
  /** Unused for emoji (color glyph); kept for call-site compatibility. */
  color?: string;
  style?: StyleProp<ImageStyle>;
}) {
  return (
    <Image
      source={require('../../../assets/emoji/medal.png')}
      style={[{ width: size, height: size }, style]}
      resizeMode="contain"
      accessibilityLabel="Medal"
    />
  );
}
