import React from 'react';
import { Image, View } from 'react-native';
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
import RetroDailyFlip from './RetroDailyFlip';
import { TEAM_BADGES } from '../../lib/teamBadges';
import { normalizeTeamCode } from '../../lib/teamColors';
import type { RetroFixture, RetroPick } from '../../lib/retroDaily/mockPuzzle';
import { RETRO_PIXEL_FONT } from '../../lib/retroDaily/retroFont';
import RetroDailyTotlPattern from './RetroDailyTotlPattern';

/** Sit on the loading face before revealing the score. */
export const RETRO_REVEAL_HOLD_MS = 2000;
/** Transition duration into the score face (kept for parent unlock timing). */
export const RETRO_REVEAL_FLIP_MS = 420;
/** Seconds shown on the score face before auto-advancing (3 → 2 → 1). */
export const RETRO_REVEAL_NEXT_BEAT_MS = 900;

export function resultMatchesPick(fixture: RetroFixture, pick: RetroPick | null): boolean {
  return pick != null && pick === fixture.result;
}

export type RetroRoundOutcome = {
  fixture: RetroFixture;
  pick: RetroPick | null;
  correct: boolean;
  timedOut: boolean;
};

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

/** Teal hold face: bouncing ball + dots while waiting for the score. */
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

function CountdownDigit({ value }: { value: number }) {
  const enter = useSharedValue(0);
  React.useEffect(() => {
    enter.value = 0;
    enter.value = withTiming(1, { duration: 350, easing: Easing.out(Easing.cubic) });
  }, [enter, value]);

  const style = useAnimatedStyle(() => ({
    opacity: interpolate(enter.value, [0, 1], [0.35, 1]),
    transform: [{ scale: interpolate(enter.value, [0, 1], [0.7, 1]) }],
  }));

  return (
    <Animated.View style={style}>
      <TotlText
        style={{
          fontFamily: RETRO_PIXEL_FONT,
          fontSize: 48,
          lineHeight: 56,
          fontWeight: '900',
          color: '#64748B',
          textAlign: 'center',
        }}
      >
        {value}
      </TotlText>
    </Animated.View>
  );
}

function ScoreFace({
  fixture,
  correct,
  timedOut,
  nextCountdown,
  swipeHint,
}: {
  fixture: RetroFixture;
  correct: boolean;
  timedOut: boolean;
  nextCountdown: number | null;
  swipeHint: boolean;
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
              style={{ marginTop: 8, fontWeight: '800', textAlign: 'center', lineHeight: 18, fontSize: 12 }}
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
              style={{ marginTop: 8, fontWeight: '800', textAlign: 'center', lineHeight: 18, fontSize: 12 }}
              numberOfLines={2}
            >
              {fixture.awayName}
            </TotlText>
          </View>
        </View>

        <View
          style={{
            alignSelf: 'center',
            marginTop: 24,
            paddingHorizontal: 20,
            paddingVertical: 8,
            borderRadius: 999,
            backgroundColor: statusBg,
          }}
        >
          <TotlText style={{ color: '#FFFFFF', fontWeight: '900', fontSize: 14 }}>{statusLabel}</TotlText>
        </View>
      </View>

      <View style={{ height: 56, alignItems: 'center', justifyContent: 'center' }}>
        {nextCountdown != null ? (
          <CountdownDigit key={nextCountdown} value={nextCountdown} />
        ) : swipeHint ? (
          <TotlText style={{ textAlign: 'center', fontWeight: '800', color: '#475569', fontSize: 14 }}>
            Swipe to see your score
          </TotlText>
        ) : null}
      </View>
    </Card>
  );
}

/**
 * Holds on loading, then flips to score.
 * Streak continues → big 3-2-1 then onAutoAdvance.
 * Run over (wrong / last) → “Swipe to see your score” (parent unlocks swipe).
 */
export default function RetroDailyRevealCard({
  fixture,
  correct,
  timedOut,
  flipKey = 0,
  holdMs = RETRO_REVEAL_HOLD_MS,
  flipMs = RETRO_REVEAL_FLIP_MS,
  beatMs = RETRO_REVEAL_NEXT_BEAT_MS,
  autoContinue = false,
  swipeReady = false,
  onAutoAdvance,
  /** Skip Checking… — used when the stack remounts this face as the flying outgoing card. */
  instant = false,
}: {
  fixture: RetroFixture;
  correct: boolean;
  timedOut: boolean;
  flipKey?: number;
  holdMs?: number;
  flipMs?: number;
  beatMs?: number;
  /** True when the next fixture should auto-appear after 3-2-1. */
  autoContinue?: boolean;
  /** Parent has unlocked swipe for the score-sheet path. */
  swipeReady?: boolean;
  onAutoAdvance?: () => void;
  instant?: boolean;
}) {
  const [showScore, setShowScore] = React.useState(instant);
  const [nextCountdown, setNextCountdown] = React.useState<number | null>(null);
  const onAutoAdvanceRef = React.useRef(onAutoAdvance);
  onAutoAdvanceRef.current = onAutoAdvance;

  React.useEffect(() => {
    if (instant) {
      setShowScore(true);
      setNextCountdown(null);
      return;
    }
    setShowScore(false);
    setNextCountdown(null);
    const id = setTimeout(() => setShowScore(true), holdMs);
    return () => clearTimeout(id);
  }, [fixture.id, flipKey, holdMs, instant]);

  React.useEffect(() => {
    if (instant || !showScore || !autoContinue || !onAutoAdvanceRef.current) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => setNextCountdown(3), Math.max(0, flipMs + 80)));
    timers.push(setTimeout(() => setNextCountdown(2), flipMs + 80 + beatMs));
    timers.push(setTimeout(() => setNextCountdown(1), flipMs + 80 + beatMs * 2));
    timers.push(
      setTimeout(() => {
        setNextCountdown(null);
        onAutoAdvanceRef.current?.();
      }, flipMs + 80 + beatMs * 3)
    );
    return () => timers.forEach((t) => clearTimeout(t));
  }, [showScore, autoContinue, instant, flipMs, beatMs, fixture.id, flipKey]);

  if (instant) {
    return (
      <View style={{ flex: 1 }}>
        <ScoreFace
          fixture={fixture}
          correct={correct}
          timedOut={timedOut}
          nextCountdown={null}
          swipeHint={false}
        />
      </View>
    );
  }

  return (
    <RetroDailyFlip
      resetKey={`${flipKey}-${fixture.id}-${correct}-${timedOut}`}
      showB={showScore}
      durationMs={flipMs}
      faceA={<LoadingFace />}
      faceB={
        <ScoreFace
          fixture={fixture}
          correct={correct}
          timedOut={timedOut}
          nextCountdown={autoContinue ? nextCountdown : null}
          swipeHint={!autoContinue && swipeReady}
        />
      }
    />
  );
}
