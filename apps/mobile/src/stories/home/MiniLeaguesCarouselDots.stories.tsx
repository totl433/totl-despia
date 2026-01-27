import type { Meta, StoryObj } from '@storybook/react-native'
import React from 'react'
import { View } from 'react-native'
import type { ICarouselInstance } from 'react-native-reanimated-carousel'
import { Extrapolation, interpolate, useSharedValue } from 'react-native-reanimated'
import { Screen, useTokens } from '@totl/ui'
import MiniLeagueCard, { type MiniLeagueTableRowWithAvatar } from '../../components/MiniLeagueCard'
import CarouselWithPagination from '../../components/home/CarouselWithPagination'
import CarouselFocusShell from '../../components/home/CarouselFocusShell'

const meta: Meta<typeof MiniLeaguesCarouselDotsStory> = {
  title: 'App/Home/MiniLeaguesCarouselDots',
  component: MiniLeaguesCarouselDotsStory,
}

export default meta
type Story = StoryObj<typeof MiniLeaguesCarouselDotsStory>

function MiniLeaguesCarouselDotsStory({ count }: { count: number }) {
  const t = useTokens()
  const data = React.useMemo(() => Array.from({ length: Math.max(1, count) }, (_, i) => i), [count])

  const progress = useSharedValue(0)
  const [currentIndex, setCurrentIndex] = React.useState(0)
  const stepSV = useSharedValue(320) // card(308) + gap(12)
  const sidePeekSV = useSharedValue(34)
  const firstOffsetSV = useSharedValue(t.space[4])
  const ref = React.useRef<ICarouselInstance>(null)

  React.useEffect(() => {
    // Keep the story “peek” consistent: 308px card with 12px gap in a full-width viewport.
    stepSV.value = 320
    firstOffsetSV.value = t.space[4]
  }, [stepSV, firstOffsetSV, t.space])

  const rows: MiniLeagueTableRowWithAvatar[] = [
    { user_id: 'u1', name: 'cakehurst', score: 2, unicorns: 0, avatar_url: null },
    { user_id: 'u2', name: 'Carl', score: 1, unicorns: 0, avatar_url: null },
    { user_id: 'u3', name: 'Jof', score: 0, unicorns: 0, avatar_url: null },
    { user_id: 'u4', name: 'SP', score: 0, unicorns: 0, avatar_url: null },
  ]

  return (
    <Screen fullBleed>
      <View style={{ paddingHorizontal: t.space[4], paddingTop: 24 }}>
        <View style={{ height: 12 }} />
      </View>

      <CarouselWithPagination
        carouselRef={ref}
        width={360}
        height={360}
        data={data}
        progress={progress}
        currentIndex={currentIndex}
        onIndexChange={(idx) => setCurrentIndex(idx)}
        dotsGap={0}
        sectionBottomPadding={16}
        dotsName="Mini leagues"
        customAnimation={(value) => {
          'worklet'
          const step = stepSV.value
          const firstOffset = firstOffsetSV.value
          const sidePeek = sidePeekSV.value
          const translate = value * step
          const offset = interpolate(progress.value, [0, 1], [firstOffset, sidePeek], Extrapolation.CLAMP)
          return { transform: [{ translateX: offset + translate }] }
        }}
        style={{
          width: 360,
          height: 360,
          alignSelf: 'center',
        }}
        renderItem={({ item: i, animationValue }) => (
          <CarouselFocusShell animationValue={animationValue} width={308}>
            <MiniLeagueCard
              title={`AGI UNITED ${i + 1}`}
              avatarUri={null}
              gwIsLive
              winnerChip={null}
              rows={rows.slice(0, Math.min(4, (i % 4) + 1))}
              width={308}
              fixedRowCount={4}
            />
          </CarouselFocusShell>
        )}
      />
    </Screen>
  )
}

export const Default: Story = { args: { count: 5 } }
export const ManyPages: Story = { args: { count: 25 } }

