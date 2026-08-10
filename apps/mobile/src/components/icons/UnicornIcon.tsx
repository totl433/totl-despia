import React from 'react';
import { Image, type ImageStyle, type StyleProp } from 'react-native';

/**
 * Unicorn column marker — Apple Color Emoji 🦄 rendered as bitmap.
 *
 * Why not raw Text "🦄"? Gramatika + RN Text on iOS Simulator often fall back to
 * tofu (? box) for emoji codepoints. Live can look fine outside custom faces.
 * Rasterising Apple Color Emoji matches system unicorn art and is reliable in-sim.
 */
export default function UnicornIcon({
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
      source={require('../../../assets/emoji/unicorn.png')}
      style={[{ width: size, height: size }, style]}
      resizeMode="contain"
      accessibilityLabel="Unicorns"
    />
  );
}
