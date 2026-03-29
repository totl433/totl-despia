import React, { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import type { ICarouselInstance } from 'react-native-reanimated-carousel';
import Reanimated, { Extrapolation, interpolate, useSharedValue } from 'react-native-reanimated';
import { Card, TotlText, useTokens } from '@totl/ui';
import SectionHeaderRow from './SectionHeaderRow';
import CarouselWithPagination from './CarouselWithPagination';
import CarouselFocusShell from './CarouselFocusShell';
import MiniLeagueLiveCard from './MiniLeagueLiveCard';
import { MiniLeaguesDefaultBatchCard } from '../MiniLeaguesDefaultList';
import { resolveLeagueAvatarUri } from '../../lib/leagueAvatars';

const ML_DEFAULT_DOTS_GAP_Y = -40;
const ML_LIVE_DOTS_GAP_Y = 0;
const ML_DEFAULT_SECTION_BOTTOM_PADDING = 60; // MINI_TO_GW_GAP_Y + 80
const ML_DEFAULT_HEIGHT = 350;

export interface LeagueSummary {
  id: string | number;
  name?: string | null;
  avatar?: string | null;
}

export interface HomeMiniLeaguesSectionProps {
  visible: boolean;
  screenWidth: number;
  leagues: LeagueSummary[];
  defaultLeagueBatches: LeagueSummary[][];
  liveLeagueList: LeagueSummary[];
  showMiniLeaguesLiveCards: boolean;
  viewingGw: number | null;
  onNavigateLeagues: () => void;
  onNavigateLeagueDetail: (leagueId: string, name: string) => void;
}

/**
 * Mini leagues carousel section - shows either live league cards (during LIVE/RESULTS) or default batch cards.
 * Can be toggled via the `visible` prop.
 */
export default function HomeMiniLeaguesSection({
  visible,
  screenWidth,
  leagues,
  defaultLeagueBatches,
  liveLeagueList,
  showMiniLeaguesLiveCards,
  viewingGw,
  onNavigateLeagues,
  onNavigateLeagueDetail,
}: HomeMiniLeaguesSectionProps) {
  const t = useTokens();
  const [activeLeagueIndex, setActiveLeagueIndex] = React.useState(0);
  const mlAbsoluteProgress = useSharedValue(0);
  const mlCarouselItemWidthSV = useSharedValue(0);
  const mlSidePeekSV = useSharedValue(0);
  const mlFirstItemOffsetSV = useSharedValue(0);
  const mlDefaultCarouselRef = React.useRef<ICarouselInstance>(null);

  const mlCarouselOuterGutter = t.space[4];
  const mlCardGap = 12;
  const ML_CARD_WIDTH_RATIO = 0.83;
  const ML_CARD_MAX_WIDTH = 400;
  const mlCardWidth = Math.round(Math.min(screenWidth * ML_CARD_WIDTH_RATIO, ML_CARD_MAX_WIDTH));
  const mlCarouselItemWidth = mlCardWidth + mlCardGap;
  const mlSidePeek = Math.max(0, (screenWidth - mlCardWidth) / 2);
  const mlCarouselHeight = 352;

  useEffect(() => {
    mlCarouselItemWidthSV.value = mlCarouselItemWidth;
    mlSidePeekSV.value = mlSidePeek;
    mlFirstItemOffsetSV.value = mlCarouselOuterGutter;
  }, [mlCarouselItemWidth, mlSidePeek, mlCarouselOuterGutter, mlCarouselItemWidthSV, mlSidePeekSV, mlFirstItemOffsetSV]);

  const miniLeaguesPageCount = showMiniLeaguesLiveCards ? liveLeagueList.length : defaultLeagueBatches.length;

  useEffect(() => {
    if (!miniLeaguesPageCount) {
      if (activeLeagueIndex !== 0) setActiveLeagueIndex(0);
      return;
    }
    if (activeLeagueIndex < 0) setActiveLeagueIndex(0);
    if (activeLeagueIndex >= miniLeaguesPageCount) setActiveLeagueIndex(miniLeaguesPageCount - 1);
  }, [activeLeagueIndex, miniLeaguesPageCount]);

  if (!visible) return null;

  const customAnimation = (value: number) => {
    'worklet';
    const step = mlCarouselItemWidthSV.value;
    const sidePeek = mlSidePeekSV.value;
    const firstOffset = mlFirstItemOffsetSV.value;
    const translate = value * step;
    const offset = interpolate(mlAbsoluteProgress.value, [0, 1], [firstOffset, sidePeek], Extrapolation.CLAMP);
    const z = Math.max(0, 100 - Math.round(Math.abs(value) * 10));
    return { transform: [{ translateX: offset + translate }], zIndex: z, elevation: z };
  };

  return (
    <>
      <View style={{ marginTop: 0 }}>
        <SectionHeaderRow
          title="Mini leagues"
          right={
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Pressable
                onPress={onNavigateLeagues}
                accessibilityRole="button"
                accessibilityLabel="See all mini leagues"
                style={({ pressed }) => ({
                  paddingVertical: 6,
                  paddingHorizontal: 8,
                  opacity: pressed ? 0.8 : 1,
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                })}
              >
                <TotlText style={{ fontSize: 14, lineHeight: 14, color: t.color.brand, textAlign: 'right' }}>
                  See all
                </TotlText>
              </Pressable>
            </View>
          }
        />
      </View>
      {leagues.length ? (
        showMiniLeaguesLiveCards ? (
          <CarouselWithPagination
            carouselRef={mlDefaultCarouselRef}
            width={screenWidth}
            height={mlCarouselHeight}
            data={liveLeagueList}
            progress={mlAbsoluteProgress}
            currentIndex={activeLeagueIndex}
            onIndexChange={(idx) => setActiveLeagueIndex(idx)}
            dotsGap={ML_LIVE_DOTS_GAP_Y}
            sectionBottomPadding={ML_DEFAULT_SECTION_BOTTOM_PADDING}
            dotsName="Mini leagues"
            customAnimation={customAnimation}
            style={{
              width: screenWidth,
              height: mlCarouselHeight,
              marginHorizontal: -mlCarouselOuterGutter,
            }}
            containerStyle={{ paddingBottom: 0 }}
            renderItem={({ item: league, animationValue }) => {
              const leagueId = String(league.id);
              const enabled =
                leagueId === String(liveLeagueList[activeLeagueIndex]?.id ?? '') ||
                leagueId === String(liveLeagueList[activeLeagueIndex - 1]?.id ?? '') ||
                leagueId === String(liveLeagueList[activeLeagueIndex + 1]?.id ?? '');

              return (
                <CarouselFocusShell animationValue={animationValue} width={mlCardWidth}>
                  <MiniLeagueLiveCard
                    leagueId={leagueId}
                    leagueName={String(league.name ?? '')}
                    leagueAvatar={typeof league.avatar === 'string' ? league.avatar : null}
                    gw={viewingGw as number}
                    width={mlCardWidth}
                    enabled={enabled}
                    onPress={() => onNavigateLeagueDetail(leagueId, String(league.name ?? ''))}
                  />
                </CarouselFocusShell>
              );
            }}
          />
        ) : (
          <CarouselWithPagination
            carouselRef={mlDefaultCarouselRef}
            width={screenWidth}
            height={ML_DEFAULT_HEIGHT}
            data={defaultLeagueBatches}
            progress={mlAbsoluteProgress}
            currentIndex={activeLeagueIndex}
            onIndexChange={(idx) => setActiveLeagueIndex(idx)}
            dotsGap={ML_DEFAULT_DOTS_GAP_Y}
            sectionBottomPadding={ML_DEFAULT_SECTION_BOTTOM_PADDING}
            dotsName="Mini leagues"
            customAnimation={customAnimation}
            style={{
              width: screenWidth,
              height: ML_DEFAULT_HEIGHT,
              marginHorizontal: -mlCarouselOuterGutter,
            }}
            containerStyle={{ paddingBottom: 0 }}
            renderItem={({ item: batch, animationValue }) => (
              <CarouselFocusShell animationValue={animationValue} width={mlCardWidth}>
                <MiniLeaguesDefaultBatchCard
                  width={mlCardWidth}
                  batch={batch.map((l) => ({
                    id: String(l.id),
                    name: String(l.name ?? ''),
                    avatarUri: resolveLeagueAvatarUri(typeof l.avatar === 'string' ? l.avatar : null),
                  }))}
                  onLeaguePress={(leagueId, name) => onNavigateLeagueDetail(leagueId, name)}
                />
              </CarouselFocusShell>
            )}
          />
        )
      ) : (
        <Card style={{ marginBottom: -20 }}>
          <TotlText variant="muted">No leagues yet.</TotlText>
        </Card>
      )}
    </>
  );
}
