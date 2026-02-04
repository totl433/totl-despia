import React from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { TotlText, useTokens } from '@totl/ui';

import type { GameweekAdvanceTransitionController } from '../../hooks/useGameweekAdvanceTransition';

/**
 * Wrap a screen to provide the “Match Tunnel” gameweek transition overlay.
 *
 * Usage:
 * - Create controller: `const advance = useGameweekAdvanceTransition()`
 * - Wrap screen: `<GameweekAdvanceTransition controller={advance}>{...}</GameweekAdvanceTransition>`
 * - Trigger: `advance.start({ nextGameweekLabel: 'GAMEWEEK 25', onAdvance })`
 */
export default function GameweekAdvanceTransition({
  controller,
  children,
  overlayColor,
}: {
  controller: GameweekAdvanceTransitionController;
  children: React.ReactNode;
  overlayColor?: string;
}) {
  const t = useTokens();

  const tunnelColor = overlayColor ?? '#0B3B2E';

  const onLayout = React.useCallback(
    (e: LayoutChangeEvent) => {
      const h = Math.round(e.nativeEvent.layout.height);
      if (h > 0) controller.viewportHeight.value = h;
    },
    [controller.viewportHeight]
  );

  const contentStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: controller.contentScale.value }],
      opacity: controller.contentOpacity.value,
    };
  });

  const overlayStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: controller.overlayTranslateY.value }],
      opacity: controller.overlayOpacity.value,
    };
  });

  const headlineStyle = useAnimatedStyle(() => {
    return {
      opacity: controller.textOpacity.value,
      transform: [{ scale: controller.textScale.value }],
    };
  });

  return (
    <View style={styles.root} onLayout={onLayout}>
      <Animated.View
        style={[styles.content, contentStyle]}
        pointerEvents={controller.isAnimating ? 'none' : 'auto'}
        accessibilityElementsHidden={controller.isAnimating}
        importantForAccessibility={controller.isAnimating ? 'no-hide-descendants' : 'auto'}
      >
        {/* Reanimated’s View children typing can mismatch React 19 types; render as-is. */}
        {children as any}
      </Animated.View>

      <Animated.View
        style={[StyleSheet.absoluteFillObject, styles.overlay, { backgroundColor: tunnelColor }, overlayStyle]}
        pointerEvents={controller.isAnimating ? 'auto' : 'none'}
      >
        {/* Subtle depth edge */}
        <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.12)' }]} />

        <View style={styles.center}>
          <Animated.View style={headlineStyle}>
            <TotlText
              style={{
                fontFamily: 'Gramatika-Bold',
                fontWeight: '900',
                fontSize: 44,
                lineHeight: 44,
                color: '#FFFFFF',
                textAlign: 'center',
                letterSpacing: 1,
              }}
            >
              {controller.label ?? ''}
            </TotlText>
          </Animated.View>

          <TotlText
            style={{
              marginTop: 12,
              color: 'rgba(255,255,255,0.78)',
              textAlign: 'center',
              fontFamily: t.font.body,
            }}
          >
            Updating…
          </TotlText>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1 },
  overlay: { justifyContent: 'center' },
  center: {
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

