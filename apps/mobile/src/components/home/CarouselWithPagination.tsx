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

