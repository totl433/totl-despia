import React from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import { StyleSheet, View } from 'react-native'
import type { SharedValue } from 'react-native-reanimated'
import Animated, { Extrapolation, interpolate, interpolateColor, useAnimatedStyle } from 'react-native-reanimated'
import { useTokens } from '@totl/ui'

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
  activeBorderColor,
  activeShadowColor,
}: {
  animationValue: SharedValue<number>
  children: React.JSX.Element
  width: number
  radius?: number
  style?: StyleProp<ViewStyle>
  /**
   * Optional override for the ACTIVE (centered) border color.
   * Useful when we want the active card to use a specific brand color.
   */
  activeBorderColor?: string
  /**
   * Optional override for the ACTIVE (centered) shadow color (iOS).
   * Note: Android elevation shadows aren't reliably tintable, so this primarily affects iOS.
   */
  activeShadowColor?: string
}) {
  const t = useTokens()
  const isLightMode = t.color.background.toLowerCase() === '#f8fafc'

  // Slightly stronger border when “selected” (center item).
  const selectedBorder = activeBorderColor ?? (isLightMode ? 'rgba(15,23,42,0.35)' : 'rgba(248,250,252,0.28)')
  const baseBorder = t.color.border
  const selectedShadow = activeShadowColor ?? '#000'

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

  const borderOverlayStyle = useAnimatedStyle(() => {
    const d = Math.min(1, Math.abs(animationValue.value))
    const borderColor = interpolateColor(d, [0, 1], [selectedBorder, baseBorder])
    return { borderColor }
  }, [baseBorder, selectedBorder])

  return (
    <Animated.View pointerEvents="box-none" style={[{ flex: 1 }, outerStyle, style]}>
      {/* IMPORTANT: do NOT change the card's X position here.
          The carousel translate math in HomeScreen expects the card to be anchored at the item's left edge.
          We only add bottom breathing room so the shadow can fade naturally without clipping. */}
      <View style={{ flex: 1, justifyContent: 'flex-start', paddingBottom: 18 }} pointerEvents="box-none">
        <Animated.View pointerEvents="box-none" style={[{ width, borderRadius: radius }, innerStyle]}>
          {children}
          {/* Draw the border ABOVE the card contents so it can't be covered/cut by child backgrounds. */}
          <Animated.View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFillObject,
              { borderRadius: radius, borderWidth: 1 },
              borderOverlayStyle,
            ]}
          />
        </Animated.View>
      </View>
    </Animated.View>
  )
}

