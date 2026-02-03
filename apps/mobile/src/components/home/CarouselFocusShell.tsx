import React from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import { StyleSheet, View } from 'react-native'
import type { SharedValue } from 'react-native-reanimated'
import Animated, { Extrapolation, interpolate, useAnimatedStyle } from 'react-native-reanimated'
import { useTokens } from '@totl/ui'
import Svg, { Rect } from 'react-native-svg'

/**
 * Adds “selected card focus” styling to carousel items:
 * - Center item: darker border + subtle shadow
 * - Neighbor items: slightly dimmed
 *
 * Drive it with the RNRC-provided `animationValue` (0 = centered, 1 = neighbor).
 */
export default function CarouselFocusShell({
  animationValue,
  children,
  width,
  radius = 16,
  style,
}: {
  animationValue: SharedValue<number>
  children: React.JSX.Element
  width: number
  radius?: number
  style?: StyleProp<ViewStyle>
}) {
  const t = useTokens()
  const baseBorder = '#E2E3E5'
  const selectedShadow = '#000' // “native” shadow (neutral grey when combined with opacity)

  const [measuredH, setMeasuredH] = React.useState<number>(0)

  const outerStyle = useAnimatedStyle(() => {
    // `animationValue.value` is roughly 0 at center, +/-1 for neighbors.
    const d = Math.min(1, Math.abs(animationValue.value))

    // Stronger dimming for non-active cards.
    const opacity = interpolate(d, [0, 1], [1, 0.6], Extrapolation.CLAMP)

    return {
      opacity,
    }
  }, [])

  const innerStyle = useAnimatedStyle(() => {
    const d = Math.min(1, Math.abs(animationValue.value))

    // Avoid scaling up the selected card: even tiny upscales can get clipped by carousel internals,
    // which looks like the border is “missing” on one edge.
    const scale = interpolate(d, [0, 1], [1.0, 0.985], Extrapolation.CLAMP)

    // Shadow only for the selected card, but animated so it’s smooth while swiping.
    const shadowOpacity = interpolate(d, [0, 1], [0.16, 0], Extrapolation.CLAMP)
    const shadowRadius = interpolate(d, [0, 1], [12, 0], Extrapolation.CLAMP)
    const elevation = interpolate(d, [0, 1], [8, 0], Extrapolation.CLAMP)

    return {
      transform: [{ scale }],
      borderRadius: radius,
      shadowColor: selectedShadow,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity,
      shadowRadius,
      elevation,
    }
  }, [radius, selectedShadow])

  const gradientBorderStyle = useAnimatedStyle(() => {
    const d = Math.min(1, Math.abs(animationValue.value))
    return {
      opacity: interpolate(d, [0, 1], [1, 0], Extrapolation.CLAMP),
    }
  }, [])

  return (
    <Animated.View pointerEvents="box-none" style={[{ flex: 1 }, outerStyle, style]}>
      {/* IMPORTANT: do NOT change the card's X position here.
          The carousel translate math in HomeScreen expects the card to be anchored at the item's left edge.
          We only add bottom breathing room so the shadow can fade naturally without clipping. */}
      <View style={{ flex: 1, justifyContent: 'flex-start', paddingBottom: 18 }} pointerEvents="box-none">
        <Animated.View
          pointerEvents="box-none"
          onLayout={(e) => {
            const h = Math.round(e.nativeEvent.layout.height)
            if (!h) return
            setMeasuredH((prev) => (prev === h ? prev : h))
          }}
          style={[{ width, borderRadius: radius }, innerStyle]}
        >
          {children}
          {/* Base border (all cards). */}
          <View
            pointerEvents="none"
            style={[StyleSheet.absoluteFillObject, { borderRadius: radius, borderWidth: 1, borderColor: baseBorder }]}
          />

          {/* Active border overlay: subtle border, fades out for non-active cards. */}
          {measuredH > 0 ? (
            <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFillObject, gradientBorderStyle]}>
              <Svg width={width} height={measuredH}>
                <Rect
                  x={0.5}
                  y={0.5}
                  width={Math.max(0, width - 1)}
                  height={Math.max(0, measuredH - 1)}
                  rx={Math.max(0, radius - 0.5)}
                  ry={Math.max(0, radius - 0.5)}
                  fill="transparent"
                  stroke={baseBorder}
                  strokeWidth={1}
                />
              </Svg>
            </Animated.View>
          ) : null}
        </Animated.View>
      </View>
    </Animated.View>
  )
}

