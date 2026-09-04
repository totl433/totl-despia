import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Card, TotlText, useTokens } from '@totl/ui';
import { TEAM_BADGES } from '../../lib/teamBadges';
import { normalizeTeamCode } from '../../lib/teamColors';
import type { RetroFixture, RetroPick } from '../../lib/retroDaily/mockPuzzle';
import { RETRO_PIXEL_FONT } from '../../lib/retroDaily/retroFont';
import RetroDailyTotlPattern from './RetroDailyTotlPattern';

/** Sit on the loading face before the flip. */
export const RETRO_REVEAL_HOLD_MS = 2000;
/** Card-flip duration into the score face. */
export const RETRO_REVEAL_FLIP_MS = 720;

function BounceDot({ delayMs }: { delayMs: number }) {
  const t = useSharedValue(0);

  React.useEffect(() => {
    t.value = withDelay(
      delayMs,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 320, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 320, easing: Easing.in(Easing.quad) })
        ),
        -1,
        false
      )
    );
  }, [delayMs, t]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(t.value, [0, 1], [0, -10]) }],
    opacity: interpolate(t.value, [0, 1], [0.45, 1]),
  }));

  return (
    <Animated.View
      style={[
        {
          width: 10,
          height: 10,
          borderRadius: 5,
          backgroundColor: '#FFFFFF',
          marginHorizontal: 4,
        },
        style,
      ]}
    />
  );
}

/** Teal hold face: bouncing ball + dots while waiting for the score flip. */
function LoadingFace() {
  const spin = useSharedValue(0);
  const bob = useSharedValue(0);

  React.useEffect(() => {
    spin.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.linear }), -1, false);
    bob.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 420, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 420, easing: Easing.inOut(Easing.quad) })
      ),
      -1,
      false
    );
  }, [bob, spin]);

  const ballStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(bob.value, [0, 1], [0, -14]) },
      { rotate: `${interpolate(spin.value, [0, 1], [0, 360])}deg` },
    ],
  }));

  return (
    <Card
      style={{
        flex: 1,
        borderRadius: 28,
        borderWidth: 0,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0F766E',
        shadowOpacity: 0,
        elevation: 0,
        paddingHorizontal: 24,
      }}
    >
      <RetroDailyTotlPattern />
      <Animated.View style={[{ marginBottom: 18, zIndex: 1 }, ballStyle]}>
        <Ionicons name="football" size={56} color="#FFFFFF" />
      </Animated.View>
      <TotlText
        style={{
          fontFamily: RETRO_PIXEL_FONT,
          fontSize: 11,
          lineHeight: 18,
          color: '#FFFFFF',
          letterSpacing: 0,
          marginBottom: 16,
          textAlign: 'center',
          zIndex: 1,
        }}
      >
        Checking result…
      </TotlText>
      <View style={{ flexDirection: 'row', alignItems: 'center', zIndex: 1 }}>
        <BounceDot delayMs={0} />
        <BounceDot delayMs={140} />
        <BounceDot delayMs={280} />
      </View>
    </Card>
  );
}

function StatusBadge({
  label,
  backgroundColor,
  pulse,
}: {
  label: string;
  backgroundColor: string;
  pulse: boolean;
}) {
  const beat = useSharedValue(0);

  React.useEffect(() => {
    if (!pulse) {
      beat.value = 0;
      return;
    }
    beat.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 520, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 520, easing: Easing.in(Easing.quad) })
      ),
      -1,
      false
    );
  }, [beat, pulse]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(beat.value, [0, 1], [1, 1.08]) }],
    opacity: interpolate(beat.value, [0, 1], [0.88, 1]),
  }));

  return (
    <Animated.View
      style={[
        {
          alignSelf: 'center',
          marginTop: 18,
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderRadius: 12,
          backgroundColor,
          maxWidth: '92%',
        },
        style,
      ]}
    >
      <TotlText
        style={{
          fontFamily: RETRO_PIXEL_FONT,
          color: '#FFFFFF',
          fontSize: 11,
          lineHeight: 16,
          textAlign: 'center',
        }}
      >
        {label}
      </TotlText>
    </Animated.View>
  );
}

function ScoreFace({
  fixture,
  correct,
  timedOut,
  showNextHint,
}: {
  fixture: RetroFixture;
  correct: boolean;
  timedOut: boolean;
  showNextHint: boolean;
}) {
  const t = useTokens();
  const home = normalizeTeamCode(fixture.homeCode);
  const away = normalizeTeamCode(fixture.awayCode);
  const homeBadge = TEAM_BADGES[home] ?? null;
  const awayBadge = TEAM_BADGES[away] ?? null;
  const statusBg = correct ? '#1C8376' : '#DC2626';
  const statusLabel = timedOut ? 'TOO SLOW!' : correct ? 'CORRECT' : 'INCORRECT';

  return (
    <Card
      style={{
        flex: 1,
        borderRadius: 28,
        borderWidth: 0,
        overflow: 'hidden',
        backgroundColor: '#FFFFFF',
        padding: 20,
        shadowOpacity: 0,
        elevation: 0,
      }}
    >
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1, alignItems: 'center' }}>
            {homeBadge ? <Image source={homeBadge} style={{ width: 64, height: 64 }} resizeMode="contain" /> : null}
            <TotlText
              style={{ marginTop: 8, fontWeight: '800', textAlign: 'center', lineHeight: 18 }}
              numberOfLines={2}
            >
              {fixture.homeName}
            </TotlText>
          </View>

          <View style={{ minWidth: 72, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 }}>
            <TotlText
              style={{
                fontSize: 32,
                lineHeight: 40,
                fontWeight: '900',
                color: t.color.text,
                textAlign: 'center',
              }}
            >
              {fixture.homeScore}–{fixture.awayScore}
            </TotlText>
          </View>

          <View style={{ flex: 1, alignItems: 'center' }}>
            {awayBadge ? <Image source={awayBadge} style={{ width: 64, height: 64 }} resizeMode="contain" /> : null}
            <TotlText
              style={{ marginTop: 8, fontWeight: '800', textAlign: 'center', lineHeight: 18 }}
              numberOfLines={2}
            >
              {fixture.awayName}
            </TotlText>
          </View>
        </View>

        <StatusBadge label={statusLabel} backgroundColor={statusBg} pulse={correct} />
      </View>

      <TotlText style={{ textAlign: 'center', fontWeight: '800', color: '#334155', fontSize: 14 }}>
        {showNextHint
          ? correct
            ? 'Swipe to see the next fixture'
            : 'Swipe to see your score'
          : ' '}
      </TotlText>
    </Card>
  );
}

/**
 * Holds on a loading face, then flips to score + CORRECT / INCORRECT / Too slow!
 */
export default function RetroDailyRevealCard({
  fixture,
  correct,
  timedOut,
  showNextHint,
  flipKey = 0,
  holdMs = RETRO_REVEAL_HOLD_MS,
  flipMs = RETRO_REVEAL_FLIP_MS,
  instant = false,
}: {
  fixture: RetroFixture;
  correct: boolean;
  timedOut: boolean;
  showNextHint: boolean;
  flipKey?: number;
  holdMs?: number;
  flipMs?: number;
  instant?: boolean;
}) {
  const progress = useSharedValue(instant ? 1 : 0);

  React.useEffect(() => {
    if (instant) {
      progress.value = 1;
      return;
    }
    progress.value = 0;
    progress.value = withDelay(
      holdMs,
      withTiming(1, {
        duration: flipMs,
        easing: Easing.bezier(0.22, 1, 0.36, 1),
      })
    );
  }, [fixture.id, flipKey, flipMs, holdMs, instant, progress]);

  const loadingStyle = useAnimatedStyle(() => {
    const rotate = interpolate(progress.value, [0, 1], [0, 180]);
    return {
      ...StyleSheet.absoluteFillObject,
      backfaceVisibility: 'hidden' as const,
      transform: [{ perspective: 1200 }, { rotateY: `${rotate}deg` }],
    };
  });

  const scoreStyle = useAnimatedStyle(() => {
    const rotate = interpolate(progress.value, [0, 1], [180, 360]);
    return {
      ...StyleSheet.absoluteFillObject,
      backfaceVisibility: 'hidden' as const,
      transform: [{ perspective: 1200 }, { rotateY: `${rotate}deg` }],
    };
  });

  if (instant) {
    return (
      <View style={{ flex: 1, borderRadius: 28, overflow: 'hidden' }}>
        <ScoreFace
          fixture={fixture}
          correct={correct}
          timedOut={timedOut}
          showNextHint={showNextHint}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, borderRadius: 28, overflow: 'hidden' }}>
      <Animated.View style={loadingStyle}>
        <LoadingFace />
      </Animated.View>
      <Animated.View style={scoreStyle}>
        <ScoreFace
          fixture={fixture}
          correct={correct}
          timedOut={timedOut}
          showNextHint={showNextHint}
        />
      </Animated.View>
    </View>
  );
}

export function resultMatchesPick(fixture: RetroFixture, pick: RetroPick | null): boolean {
  return pick != null && pick === fixture.result;
}
