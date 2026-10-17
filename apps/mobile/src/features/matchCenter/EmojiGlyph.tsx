import { Image } from 'react-native';

/**
 * Apple Color Emoji drawn as a bitmap.
 * Gramatika has no emoji, and RN Text on the simulator turns those code points into "?".
 */
const BITMAPS: Record<number, number> = {
  0x26bd: require('../../../assets/emoji/ball.png'),
  0x2728: require('../../../assets/emoji/sparkles.png'),
  0x1f4aa: require('../../../assets/emoji/muscle.png'),
  0x1f440: require('../../../assets/emoji/eyes.png'),
  0x1f389: require('../../../assets/emoji/party.png'),
  0x1f3c6: require('../../../assets/emoji/trophy.png'),
  0x1f64c: require('../../../assets/emoji/hands.png'),
  0x1f62c: require('../../../assets/emoji/grimace.png'),
  0x1f605: require('../../../assets/emoji/sweat.png'),
  0x1f44d: require('../../../assets/emoji/thumb.png'),
  0x2764: require('../../../assets/emoji/heart.png'),
  0x1f602: require('../../../assets/emoji/joy.png'),
  0x1f525: require('../../../assets/emoji/fire.png'),
  0x1f62e: require('../../../assets/emoji/wow.png'),
  0x1f622: require('../../../assets/emoji/cry.png'),
  0x1f60a: require('../../../assets/emoji/smile.png'),
  0x1f60e: require('../../../assets/emoji/sunglasses.png'),
  0x1fae0: require('../../../assets/emoji/melt.png'),
};

export function hasEmojiBitmap(codePoint: number): boolean {
  return BITMAPS[codePoint] != null;
}

export default function EmojiGlyph({ codePoint, size }: { codePoint: number; size: number }) {
  const source = BITMAPS[codePoint];
  if (source == null) return null;
  return (
    <Image
      source={source}
      style={{ width: size, height: size, marginHorizontal: 1 }}
      resizeMode="contain"
      accessibilityIgnoresInvertColors
    />
  );
}
