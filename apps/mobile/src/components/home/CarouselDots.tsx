import React from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import { Pressable, View } from 'react-native'
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'
import type { SharedValue } from 'react-native-reanimated'
import { useTokens } from '@totl/ui'

/**
 * iOS-style pagination dots:
 * - Shows a maximum of 4 dots (sliding window over pages)
 * - Smooth transitions driven by a carousel progress SharedValue
 * - Tap-to-jump supported via `onPress` mapping
 */
export default function CarouselDots({
  progress,
  count,
  currentIndex,
  onPress,
  style,
  carouselName,
  maxDots = 4,
}: {
  progress: SharedValue<number>
  count: number
  /**
   * Current snapped index (JS state). Used only for tap-to-jump mapping.
   */
  currentIndex: number
  onPress?: (pageIndex: number) => void
  style?: StyleProp<ViewStyle>
  carouselName?: string
  maxDots?: number
}) {
  const t = useTokens()
  // Map requested greys to our semantic tokens:
  // - secondary_grey -> `muted`
  // - tertiary_grey  -> `border`
  const activeDotColor = t.color.muted
  const inactiveDotColor = t.color.border

  const visibleCount = Math.min(Math.max(0, count), maxDots)
  if (visibleCount <= 1) return null

  const ACTIVE_SLOT = Math.min(2, visibleCount - 1)
  // JS mapping for taps (matches the worklet windowing behavior at snapped positions).
  const maxStart = Math.max(0, count - visibleCount)
  const windowStart = Math.min(Math.max(currentIndex - ACTIVE_SLOT, 0), maxStart)

  const dotSize = 6
  const dotGap = 8
  const dotStep = dotSize + dotGap
  const containerWidth = visibleCount * dotSize + (visibleCount - 1) * dotGap
  const containerHeight = 12

  // Animated “window start” (integer) + a transient strip shift to avoid re-render jump.
  const windowStartSV = useSharedValue(windowStart)
  const stripShiftSV = useSharedValue(0)

  // Keep worklet + JS tap mapping aligned.
  React.useEffect(() => {
    windowStartSV.value = windowStart
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowStart])

  useAnimatedReaction(
    () => {
      const total = count
      const vCount = Math.min(Math.max(0, total), maxDots)
      const activeSlot = Math.min(2, vCount - 1)
      const maxStart = Math.max(0, total - vCount)
      const currentPage = Math.round(progress.value)
      const nextStart = Math.min(Math.max(currentPage - activeSlot, 0), maxStart)
      return { nextStart, dotStep }
    },
    (next, prev) => {
      if (!prev) return
      const prevStart = windowStartSV.value
      if (next.nextStart !== prevStart) {
        // Nudge the strip by exactly one dot-step so the visual change feels like a slide,
        // then spring back to rest.
        stripShiftSV.value = (prevStart - next.nextStart) * next.dotStep
        windowStartSV.value = next.nextStart
        stripShiftSV.value = withSpring(0, { damping: 18, stiffness: 220, mass: 0.6 })
      }
    },
    [count, maxDots, dotStep]
  )

  const stripStyle = useAnimatedStyle(() => {
    const currentPage = Math.round(progress.value)
    const delta = progress.value - currentPage // -0.5..0.5-ish while dragging
    // Move the strip subtly while dragging (iOS feel), plus the window-shift nudge.
    const tx = stripShiftSV.value - delta * dotStep
    return { transform: [{ translateX: tx }] }
  }, [dotStep])

  const activeStyle = useAnimatedStyle(() => {
    const total = count
    const vCount = Math.min(Math.max(0, total), maxDots)
    const activeSlot = Math.min(2, vCount - 1)
    const maxStart = Math.max(0, total - vCount)
    const currentPage = Math.round(progress.value)
    const start = Math.min(Math.max(currentPage - activeSlot, 0), maxStart)
    const activePos = Math.min(Math.max(currentPage - start, 0), vCount - 1)
    return {
      transform: [{ translateX: activePos * dotStep }, { scale: 1.55 }],
      opacity: 1,
      backgroundColor: activeDotColor,
    }
  }, [count, maxDots, dotStep, activeDotColor])

  return (
    <View
      style={[
        {
          marginTop: 0, // closer to cards (iOS feel)
          alignSelf: 'center',
          width: containerWidth,
          height: containerHeight,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
      accessibilityRole="tablist"
      accessibilityLabel={carouselName ? `${carouselName} pages` : 'Pages'}
    >
      {/* Masked sliding dot strip (inactive dots). */}
      <View style={{ width: containerWidth, height: containerHeight, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View
          style={[
            {
              flexDirection: 'row',
              alignItems: 'center',
            },
            stripStyle,
          ]}
        >
          {Array.from({ length: visibleCount }).map((_, i) => {
            const pageIndex = windowStart + i
            return (
              <Pressable
                key={i}
                onPress={() => onPress?.(pageIndex)}
                accessibilityRole="button"
                accessibilityLabel={
                  carouselName
                    ? `${carouselName} page ${pageIndex + 1} of ${count}`
                    : `Page ${pageIndex + 1} of ${count}`
                }
                accessibilityHint="Go to page"
                style={({ pressed }) => ({
                  width: dotSize,
                  height: dotSize,
                  borderRadius: 999,
                  backgroundColor: inactiveDotColor,
                  // Avoid compounding opacity on an already-transparent token (border is rgba in both themes).
                  opacity: pressed ? 0.7 : 1,
                  marginRight: i === visibleCount - 1 ? 0 : dotGap,
                })}
              />
            )
          })}
        </Animated.View>
      </View>

      {/* Active dot overlay (appears “fixed” at slot 3 in the middle). */}
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            left: 0,
            top: (containerHeight - dotSize) / 2,
            width: dotSize,
            height: dotSize,
            borderRadius: 999,
          },
          activeStyle,
        ]}
      />
    </View>
  )
}

