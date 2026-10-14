import React from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { TotlText, useTokens } from '@totl/ui';
import type { LeaguePick } from '../league/LeaguePickPill';
import LeaguePickChipsRow from '../league/LeaguePickChipsRow';
import { fixtureMlPicksToMap, type FixtureMlSwipeLeague } from './fixtureMlSwipeTypes';

const SNAP_SPRING = { damping: 24, stiffness: 260, mass: 0.8 } as const;
const COMMIT_DX = 48;
const COMMIT_VX = 420;

function MlPageBottom({
  league,
  outcome,
  currentUserId,
}: {
  league: FixtureMlSwipeLeague;
  outcome: LeaguePick | null;
  currentUserId: string | null;
}) {
  const t = useTokens();
  return (
    <View style={{ paddingHorizontal: 8, paddingTop: 2, paddingBottom: 2, justifyContent: 'center' }}>
      <TotlText
        numberOfLines={1}
        style={{
          textAlign: 'center',
          fontSize: 13,
          lineHeight: 16,
          fontWeight: '700',
          color: t.color.text,
          marginBottom: 8,
        }}
      >
        {league.name}
      </TotlText>
      <LeaguePickChipsRow
        members={league.members}
        picksByUserId={fixtureMlPicksToMap(league.picksByUserId)}
        outcome={outcome}
        currentUserId={currentUserId}
        compact
      />
    </View>
  );
}

/**
 * Post-deadline expanded fixture pager — bottom section only.
 * Page 0 = standard % tabs / form; then one page per mini-league.
 */
export default function ExpandedFixtureMlSwipe({
  enabled,
  leagues,
  currentUserId,
  outcome,
  resetKey,
  showDivider = true,
  children,
}: {
  enabled: boolean;
  leagues: FixtureMlSwipeLeague[];
  currentUserId: string | null;
  outcome: LeaguePick | null;
  resetKey?: string | number | boolean | null;
  showDivider?: boolean;
  children: React.ReactElement | null;
}) {
  const t = useTokens();
  const canSwipe = enabled && leagues.length > 0;
  const pageCount = canSwipe ? 1 + leagues.length : 1;
  const [page, setPage] = React.useState(0);
  const [trackWidth, setTrackWidth] = React.useState(0);

  const widthSV = useSharedValue(0);
  const pageSV = useSharedValue(0);
  const translateX = useSharedValue(0);
  const dragStartX = useSharedValue(0);

  const resetToDefault = React.useCallback(() => {
    setPage(0);
    pageSV.value = 0;
    translateX.value = 0;
  }, [pageSV, translateX]);

  React.useEffect(() => {
    resetToDefault();
  }, [resetKey, canSwipe, leagues.length, resetToDefault]);

  React.useEffect(() => {
    if (trackWidth <= 0) return;
    widthSV.value = trackWidth;
    translateX.value = -pageSV.value * trackWidth;
  }, [trackWidth, widthSV, translateX, pageSV]);

  const commitPage = React.useCallback((next: number) => {
    setPage(next);
  }, []);

  const pan = React.useMemo(
    () =>
      Gesture.Pan()
        .enabled(canSwipe)
        .activeOffsetX([-18, 18])
        .failOffsetY([-14, 14])
        .onBegin(() => {
          'worklet';
          dragStartX.value = translateX.value;
        })
        .onUpdate((e) => {
          'worklet';
          const w = widthSV.value;
          if (w <= 0) return;
          const raw = dragStartX.value + e.translationX;
          const min = -(pageCount - 1) * w;
          const max = 0;
          if (raw > max) {
            translateX.value = max + (raw - max) * 0.28;
          } else if (raw < min) {
            translateX.value = min + (raw - min) * 0.28;
          } else {
            translateX.value = raw;
          }
        })
        .onEnd((e) => {
          'worklet';
          const w = widthSV.value;
          if (w <= 0) return;

          const current = pageSV.value;
          let next = current;
          if (e.translationX <= -COMMIT_DX || e.velocityX <= -COMMIT_VX) {
            next = current + 1;
          } else if (e.translationX >= COMMIT_DX || e.velocityX >= COMMIT_VX) {
            next = current - 1;
          }

          if (next >= pageCount) next = 0;
          else if (next < 0) next = pageCount - 1;

          pageSV.value = next;
          runOnJS(commitPage)(next);
          translateX.value = withSpring(-next * w, SNAP_SPRING);
        }),
    [canSwipe, pageCount, dragStartX, translateX, widthSV, pageSV, commitPage]
  );

  const trackStyle = useAnimatedStyle(() => ({
    width: Math.max(widthSV.value, 1) * pageCount,
    transform: [{ translateX: translateX.value }],
  }));

  if (!canSwipe) {
    return children;
  }

  return (
    <GestureDetector gesture={pan}>
      <View style={{ marginTop: 4 }}>
        {showDivider ? (
          <View
            style={{
              height: 1,
              marginHorizontal: 12,
              marginBottom: 12,
              backgroundColor: t.color.border,
              opacity: 0.9,
            }}
          />
        ) : null}
        <View
          onLayout={(e) => {
            const w = Math.round(e.nativeEvent.layout.width);
            if (w > 0 && w !== trackWidth) setTrackWidth(w);
          }}
          style={{ overflow: 'hidden', width: '100%' }}
        >
          {trackWidth <= 0 ? (
            <View>{children}</View>
          ) : (
            <Reanimated.View style={[{ flexDirection: 'row', alignItems: 'flex-start' }, trackStyle]}>
              <View style={{ width: trackWidth, flexShrink: 0 }}>{children}</View>
              {leagues.map((league) => (
                <View key={league.id} style={{ width: trackWidth, flexShrink: 0 }}>
                  <MlPageBottom league={league} outcome={outcome} currentUserId={currentUserId} />
                </View>
              ))}
            </Reanimated.View>
          )}
        </View>

        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{
            marginTop: 10,
            marginBottom: 2,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 5,
          }}
        >
          {Array.from({ length: pageCount }, (_, i) => {
            const active = i === page;
            return (
              <View
                key={`ml-dot-${i}`}
                style={{
                  width: active ? 7 : 6,
                  height: active ? 7 : 6,
                  borderRadius: 999,
                  backgroundColor: active ? t.color.brand : t.color.border,
                  opacity: active ? 1 : 0.85,
                }}
              />
            );
          })}
        </View>
      </View>
    </GestureDetector>
  );
}
