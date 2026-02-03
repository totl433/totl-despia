import React from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import { View } from 'react-native'
import Carousel from 'react-native-reanimated-carousel'
import type { CarouselRenderItem, ICarouselInstance } from 'react-native-reanimated-carousel'
import type { SharedValue } from 'react-native-reanimated'

import CarouselDots from './CarouselDots'

/**
 * Layout helper that keeps the carousel viewport + dots in normal flow.
 * This ensures dots move up/down with the viewport height (no absolute anchoring).
 *
 * Controls:
 * - `dotsGap`: vertical gap between viewport and dots
 * - `sectionBottomPadding`: vertical gap below the whole block (viewport+dots)
 */
export default function CarouselWithPagination<ItemT>({
  carouselRef,
  width,
  height,
  data,
  progress,
  currentIndex,
  onIndexChange,
  customAnimation,
  style,
  containerStyle,
  dotsGap = 0,
  sectionBottomPadding = 0,
  dotsName,
  windowSize = 5,
  pagingEnabled = true,
  snapEnabled = true,
  autoFillData = false,
  loop = false,
  renderItem,
}: {
  carouselRef: React.RefObject<ICarouselInstance | null>
  width: number
  height: number
  data: ItemT[]
  progress: SharedValue<number>
  currentIndex: number
  onIndexChange: (index: number) => void
  customAnimation: (value: number) => ViewStyle
  style?: StyleProp<ViewStyle>
  containerStyle?: StyleProp<ViewStyle>
  dotsGap?: number
  sectionBottomPadding?: number
  dotsName?: string
  windowSize?: number
  pagingEnabled?: boolean
  snapEnabled?: boolean
  autoFillData?: boolean
  loop?: boolean
  renderItem: CarouselRenderItem<ItemT>
}) {
  const dotCount = data.length
  // Gesture tuning:
  // - Vertical scroll on the page should win unless the user is clearly swiping horizontally.
  // - We do this by requiring a minimum horizontal displacement before the pan activates,
  //   and failing the gesture quickly when vertical displacement is detected.
  const HORIZONTAL_LOCK_PX = 12
  const VERTICAL_FAIL_PX = 8

  return (
    <View style={{ marginBottom: sectionBottomPadding }}>
      {/* Ensure shadows/borders can render without being chopped by a hidden overflow boundary. */}
      <View pointerEvents="box-none" style={{ overflow: 'visible' }}>
        <Carousel
          ref={carouselRef}
          width={width}
          height={height}
          data={data}
          loop={loop}
          autoFillData={autoFillData}
          pagingEnabled={pagingEnabled}
          snapEnabled={snapEnabled}
          windowSize={windowSize}
          onProgressChange={progress}
          customAnimation={customAnimation}
          onConfigurePanGesture={(g) => {
            // Only start capturing when the user has moved horizontally enough.
            g.activeOffsetX([-HORIZONTAL_LOCK_PX, HORIZONTAL_LOCK_PX])
            // If the user moves vertically, let the parent ScrollView take over.
            g.failOffsetY([-VERTICAL_FAIL_PX, VERTICAL_FAIL_PX])
          }}
          style={[{ overflow: 'visible' }, style]}
          containerStyle={[{ overflow: 'visible' }, containerStyle]}
          onSnapToItem={onIndexChange}
          renderItem={renderItem}
        />
      </View>

      <CarouselDots
        progress={progress}
        count={dotCount}
        currentIndex={currentIndex}
        carouselName={dotsName}
        onPress={(pageIdx) => carouselRef.current?.scrollTo({ index: pageIdx, animated: true })}
        style={{ marginTop: dotsGap }}
      />
    </View>
  )
}

