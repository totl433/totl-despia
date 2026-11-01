import React from 'react';
import { Pressable } from 'react-native';
import { Asset } from 'expo-asset';
import { SvgUri } from 'react-native-svg';
import Reanimated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

const CHEVRON = Asset.fromModule(require('../../../assets/icons/feed-scroll-up-chevron.svg')).uri;

/** It rises the last 20pt into place as it fades in, and sinks back as it goes (like WhatsApp's). */
const RISE = 20;

/**
 * Back-to-the-top button for the feed (Figma 419:125383): a 32pt white circle with a soft shadow,
 * 28pt above the bottom of the feed (above the score ticker when it shows) and 8pt from the right edge.
 */
export default function FeedScrollTopButton({
  visible,
  onPress,
  bottom = 28,
}: {
  visible: boolean;
  onPress: () => void;
  bottom?: number;
}) {
  const shown = useSharedValue(visible ? 1 : 0);
  React.useEffect(() => {
    shown.value = withTiming(visible ? 1 : 0, {
      duration: visible ? 240 : 180,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
    });
  }, [shown, visible]);
  const style = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ translateY: (1 - shown.value) * RISE }],
  }));
  return (
    <Reanimated.View pointerEvents={visible ? 'box-none' : 'none'} style={[{ position: 'absolute', right: 8, bottom, zIndex: 4 }, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back to the top"
        onPress={onPress}
        hitSlop={8}
        style={({ pressed }) => ({
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: '#FFFFFF',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.7 : 1,
          shadowColor: '#000000',
          shadowOpacity: 0.1,
          shadowRadius: 9.6,
          shadowOffset: { width: 0, height: 0 },
          elevation: 3,
        })}
      >
        <SvgUri uri={CHEVRON} width={11.5556} height={6.7354} />
      </Pressable>
    </Reanimated.View>
  );
}
