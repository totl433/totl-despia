import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { Fixture, Pick } from '@totl/domain';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { TotlText } from '@totl/ui';

import SwipePredictionCard from './SwipePredictionCard';
import FlippableSwipePredictionCard, { CARD_FLIP_MS } from './FlippableSwipePredictionCard';
import {
  buildMatchPreviewStatsFromCache,
  buildMockMatchPreviewStats,
  type MatchPreviewStats,
} from '../../lib/matchPreviewStats';

type FixtureForms = { home: string | null; away: string | null };
type CardSnapshot = {
  index: number;
  fixture: Fixture;
  forms: FixtureForms;
};
type DeckCards = {
  current: CardSnapshot | null;
  next: CardSnapshot | null;
  queued: CardSnapshot | null;
};
type TransitionState = {
  outgoing: CardSnapshot;
  nextPicks: Record<number, Pick>;
  pick: Pick;
} | null;

function isPick(v: unknown): v is Pick {
  return v === 'H' || v === 'D' || v === 'A';
}

function findFirstUnpickedIndex(fixtures: Fixture[], picks: Record<number, Pick>): number {
  return fixtures.findIndex((f) => !isPick(picks[f.fixture_index]));
}

function findNextUnpickedIndex(fixtures: Fixture[], picks: Record<number, Pick>, currentIndex: number): number {
  return fixtures.findIndex((f, i) => i > currentIndex && !isPick(picks[f.fixture_index]));
}

const EMPTY_FIXTURE_FORMS: FixtureForms = { home: null, away: null };
const ACTIVE_BG = '#1C8376';
/** Darker mint so buttons read on predictions page bg (#F1F5F9). */
const INACTIVE_BG = '#C5D9D4';
const ACTIVE_TEXT = '#FFFFFF';
const INACTIVE_TEXT = '#0F172A';
const SWIPE_THRESHOLD = 110;
const DRAW_SWIPE_THRESHOLD = 140;
const DIRECTION_RATIO = 1.2;

/** Bold under-card cue; soft opacity pulse a couple of times when a new card lands. */
function FlipHintLabel({
  flipped,
  pulseKey,
  tx,
  ty,
  hidden,
}: {
  flipped: boolean;
  pulseKey: string | number;
  tx: Animated.SharedValue<number>;
  ty: Animated.SharedValue<number>;
  /** Hide while a pick transition is in flight. */
  hidden?: boolean;
}) {
  const pulseOpacity = useSharedValue(1);

  React.useEffect(() => {
    pulseOpacity.value = 1;
    pulseOpacity.value = withSequence(
      withTiming(0.35, { duration: 340, easing: Easing.inOut(Easing.ease) }),
      withTiming(1, { duration: 340, easing: Easing.inOut(Easing.ease) }),
      withTiming(0.35, { duration: 340, easing: Easing.inOut(Easing.ease) }),
      withTiming(1, { duration: 340, easing: Easing.inOut(Easing.ease) })
    );
  }, [pulseKey, pulseOpacity]);

  const style = useAnimatedStyle(() => {
    // Fade out as soon as the card starts moving so the hint stays under the stack, not on the swipe.
    const drag = Math.min(1, (Math.abs(tx.value) + Math.abs(ty.value)) / 28);
    const base = pulseOpacity.value * (1 - drag);
    return { opacity: hidden ? 0 : base };
  }, [hidden]);

  return (
    <Animated.View
      style={[
        {
          marginTop: 22,
          marginBottom: 8,
          alignItems: 'center',
        },
        style,
      ]}
    >
      <TotlText
        style={{
          textAlign: 'center',
          fontSize: 14,
          fontWeight: '800',
          color: '#334155',
        }}
      >
        Tap card to {flipped ? 'flip back' : 'see stats'}
      </TotlText>
    </Animated.View>
  );
}

const RESET_SPRING = {
  damping: 18,
  stiffness: 220,
  mass: 0.9,
} as const;

function buildCardSnapshot(
  fixtures: Fixture[],
  formsByFixtureIndex: Map<number, FixtureForms>,
  index: number
): CardSnapshot | null {
  if (index < 0) return null;
  const fixture = fixtures[index] ?? null;
  if (!fixture) return null;
  return {
    index,
    fixture,
    forms: formsByFixtureIndex.get(fixture.fixture_index) ?? EMPTY_FIXTURE_FORMS,
  };
}

function buildDeckCards(
  fixtures: Fixture[],
  formsByFixtureIndex: Map<number, FixtureForms>,
  picks: Record<number, Pick>,
  startIndex?: number
): DeckCards {
  const currentIndex =
    typeof startIndex === 'number'
      ? startIndex
      : (() => {
          const first = findFirstUnpickedIndex(fixtures, picks);
          return first >= 0 ? first : Math.max(0, fixtures.length - 1);
        })();

  const current = buildCardSnapshot(fixtures, formsByFixtureIndex, currentIndex);
  const nextIndex = current ? findNextUnpickedIndex(fixtures, picks, current.index) : -1;
  const next = buildCardSnapshot(fixtures, formsByFixtureIndex, nextIndex);
  const queuedIndex = next ? findNextUnpickedIndex(fixtures, picks, next.index) : -1;
  const queued = buildCardSnapshot(fixtures, formsByFixtureIndex, queuedIndex);
  return { current, next, queued };
}

export default function PredictionsSwipeDeck({
  fixtures,
  picks,
  formsByFixtureIndex,
  cardWidth,
  screenWidth,
  screenHeight,
  disabled,
  onCommitPick,
  onCurrentIndexChange,
  enableCardFlip = false,
  statsByFixtureIndex,
}: {
  fixtures: Fixture[];
  picks: Record<number, Pick>;
  formsByFixtureIndex: Map<number, FixtureForms>;
  cardWidth: number;
  screenWidth: number;
  screenHeight: number;
  disabled: boolean;
  onCommitPick: (fixtureIndex: number, pick: Pick) => void;
  onCurrentIndexChange?: (index: number) => void;
  /** Admin Make Your Predictions Test: tap card to flip and see stats. */
  enableCardFlip?: boolean;
  /** Real cached preview stats keyed by fixture_index. Falls back to mock if missing. */
  statsByFixtureIndex?: Map<number, MatchPreviewStats>;
}) {
  const deckIdentity = React.useMemo(
    () => fixtures.map((fixture) => `${String(fixture.id)}:${fixture.fixture_index}`).join('|'),
    [fixtures]
  );

  const [localPicks, setLocalPicks] = React.useState<Record<number, Pick>>(picks);
  const [deck, setDeck] = React.useState<DeckCards>(() => buildDeckCards(fixtures, formsByFixtureIndex, picks));
  const [transition, setTransition] = React.useState<TransitionState>(null);
  const [settlingTopCard, setSettlingTopCard] = React.useState(false);
  const [cardFlipped, setCardFlipped] = React.useState(false);
  const [flipAnimating, setFlipAnimating] = React.useState(false);
  const flipAnimTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastDeckIdentityRef = React.useRef<string | null>(null);
  const resetAfterCommitRafRef = React.useRef<number | null>(null);

  const fixturesRef = React.useRef(fixtures);
  const formsByFixtureIndexRef = React.useRef(formsByFixtureIndex);
  const localPicksRef = React.useRef(localPicks);
  const deckRef = React.useRef(deck);

  React.useEffect(() => {
    fixturesRef.current = fixtures;
  }, [fixtures]);

  React.useEffect(() => {
    formsByFixtureIndexRef.current = formsByFixtureIndex;
  }, [formsByFixtureIndex]);

  React.useEffect(() => {
    localPicksRef.current = localPicks;
  }, [localPicks]);

  React.useEffect(() => {
    deckRef.current = deck;
  }, [deck]);

  React.useEffect(() => {
    return () => {
      if (resetAfterCommitRafRef.current) cancelAnimationFrame(resetAfterCommitRafRef.current);
      if (flipAnimTimeoutRef.current) clearTimeout(flipAnimTimeoutRef.current);
    };
  }, []);

  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);
  const revealProgress = useSharedValue(0);
  const isAnimatingSV = useSharedValue(0);

  const resetMotion = React.useCallback(() => {
    tx.value = 0;
    ty.value = 0;
    opacity.value = 1;
    scale.value = 1;
    revealProgress.value = 0;
    isAnimatingSV.value = 0;
  }, [isAnimatingSV, opacity, revealProgress, scale, tx, ty]);

  React.useEffect(() => {
    if (lastDeckIdentityRef.current === deckIdentity) return;
    lastDeckIdentityRef.current = deckIdentity;
    if (resetAfterCommitRafRef.current) {
      cancelAnimationFrame(resetAfterCommitRafRef.current);
      resetAfterCommitRafRef.current = null;
    }
    setTransition(null);
    setSettlingTopCard(false);
    setCardFlipped(false);
    setLocalPicks(picks);
    setDeck(buildDeckCards(fixtures, formsByFixtureIndex, picks));
    resetMotion();
  }, [deckIdentity, fixtures, formsByFixtureIndex, picks, resetMotion]);

  const currentCard = transition?.outgoing ?? deck.current;

  React.useEffect(() => {
    setCardFlipped(false);
    setFlipAnimating(false);
    if (flipAnimTimeoutRef.current) {
      clearTimeout(flipAnimTimeoutRef.current);
      flipAnimTimeoutRef.current = null;
    }
  }, [deck.current?.fixture.fixture_index]);

  const toggleCardFlip = React.useCallback(() => {
    if (!enableCardFlip || disabled || transition || flipAnimating) return;
    setFlipAnimating(true);
    setCardFlipped((v) => !v);
    if (flipAnimTimeoutRef.current) clearTimeout(flipAnimTimeoutRef.current);
    flipAnimTimeoutRef.current = setTimeout(() => {
      setFlipAnimating(false);
      flipAnimTimeoutRef.current = null;
    }, CARD_FLIP_MS);
  }, [disabled, enableCardFlip, flipAnimating, transition]);

  const statsForCard = React.useCallback(
    (fixture: Fixture) => {
      const cached = statsByFixtureIndex?.get(fixture.fixture_index);
      if (cached) return cached;
      return buildMockMatchPreviewStats({
        homeCode: fixture.home_code,
        awayCode: fixture.away_code,
        gw: typeof fixture.gw === 'number' ? fixture.gw : 99,
      });
    },
    [statsByFixtureIndex]
  );

  const renderCard = React.useCallback(
    (
      snapshot: CardSnapshot,
      opts: { showSwipeHint: boolean; flipped?: boolean }
    ) => {
      if (enableCardFlip) {
        return (
          <FlippableSwipePredictionCard
            fixture={snapshot.fixture}
            showSwipeHint={opts.showSwipeHint}
            homeForm={snapshot.forms.home}
            awayForm={snapshot.forms.away}
            stats={statsForCard(snapshot.fixture)}
            flipped={opts.flipped ?? false}
          />
        );
      }
      return (
        <SwipePredictionCard
          fixture={snapshot.fixture}
          showSwipeHint={opts.showSwipeHint}
          homeForm={snapshot.forms.home}
          awayForm={snapshot.forms.away}
        />
      );
    },
    [enableCardFlip, statsForCard]
  );

  React.useEffect(() => {
    onCurrentIndexChange?.(deck.current?.index ?? Math.max(0, fixtures.length - 1));
  }, [deck.current, fixtures.length, onCurrentIndexChange]);

  const topCardStyle = useAnimatedStyle(() => {
    const rotate = `${(tx.value / Math.max(1, screenWidth)) * 18}deg`;
    return {
      opacity: opacity.value,
      transform: [{ translateX: tx.value }, { translateY: ty.value }, { rotateZ: rotate }, { scale: scale.value }],
    };
  }, [screenWidth]);

  const promotedCardStyle = useAnimatedStyle(() => {
    const progress = revealProgress.value;
    return {
      opacity: 0.84 + 0.16 * progress,
      transform: [{ translateY: 10 - 10 * progress }, { scale: 0.968 + 0.032 * progress }],
    };
  }, [revealProgress]);

  const queuedCardStyle = useAnimatedStyle(() => {
    return {
      opacity: 0.72,
      transform: [{ translateY: 20 }, { scale: 0.935 }],
    };
  }, []);

  const homeWrapStyle = useAnimatedStyle(() => {
    const absX = Math.abs(tx.value);
    const absY = Math.abs(ty.value);
    const p = tx.value < 0 && absX >= absY * 1.15 ? Math.min(1, absX / 140) : 0;
    return { transform: [{ scale: 1 + 0.05 * p }] };
  }, []);

  const awayWrapStyle = useAnimatedStyle(() => {
    const absX = Math.abs(tx.value);
    const absY = Math.abs(ty.value);
    const p = tx.value > 0 && absX >= absY * 1.15 ? Math.min(1, absX / 140) : 0;
    return { transform: [{ scale: 1 + 0.05 * p }] };
  }, []);

  const drawWrapStyle = useAnimatedStyle(() => {
    const absX = Math.abs(tx.value);
    const absY = Math.abs(ty.value);
    const p = ty.value > 0 && absY >= absX * 1.05 ? Math.min(1, absY / 140) : 0;
    return { transform: [{ scale: 1 + 0.05 * p }] };
  }, []);

  const homeBtnStyle = useAnimatedStyle(() => {
    const absX = Math.abs(tx.value);
    const absY = Math.abs(ty.value);
    const p = tx.value < 0 && absX >= absY * 1.15 ? Math.min(1, absX / 140) : 0;
    return { backgroundColor: interpolateColor(p, [0, 1], [INACTIVE_BG, ACTIVE_BG]) };
  }, []);

  const awayBtnStyle = useAnimatedStyle(() => {
    const absX = Math.abs(tx.value);
    const absY = Math.abs(ty.value);
    const p = tx.value > 0 && absX >= absY * 1.15 ? Math.min(1, absX / 140) : 0;
    return { backgroundColor: interpolateColor(p, [0, 1], [INACTIVE_BG, ACTIVE_BG]) };
  }, []);

  const drawBtnStyle = useAnimatedStyle(() => {
    const absX = Math.abs(tx.value);
    const absY = Math.abs(ty.value);
    const p = ty.value > 0 && absY >= absX * 1.05 ? Math.min(1, absY / 140) : 0;
    return { backgroundColor: interpolateColor(p, [0, 1], [INACTIVE_BG, ACTIVE_BG]) };
  }, []);

  const homeTextStyle = useAnimatedStyle(() => {
    const absX = Math.abs(tx.value);
    const absY = Math.abs(ty.value);
    const p = tx.value < 0 && absX >= absY * 1.15 ? Math.min(1, absX / 140) : 0;
    return { color: interpolateColor(p, [0, 1], [INACTIVE_TEXT, ACTIVE_TEXT]) };
  }, []);

  const awayTextStyle = useAnimatedStyle(() => {
    const absX = Math.abs(tx.value);
    const absY = Math.abs(ty.value);
    const p = tx.value > 0 && absX >= absY * 1.15 ? Math.min(1, absX / 140) : 0;
    return { color: interpolateColor(p, [0, 1], [INACTIVE_TEXT, ACTIVE_TEXT]) };
  }, []);

  const drawTextStyle = useAnimatedStyle(() => {
    const absX = Math.abs(tx.value);
    const absY = Math.abs(ty.value);
    const p = ty.value > 0 && absY >= absX * 1.05 ? Math.min(1, absY / 140) : 0;
    return { color: interpolateColor(p, [0, 1], [INACTIVE_TEXT, ACTIVE_TEXT]) };
  }, []);

  const finalizePickTransition = React.useCallback((transitionState: Exclude<TransitionState, null>) => {
    setLocalPicks(transitionState.nextPicks);
    onCommitPick(transitionState.outgoing.fixture.fixture_index, transitionState.pick);
    setTransition(null);
    setSettlingTopCard(true);
    if (resetAfterCommitRafRef.current) cancelAnimationFrame(resetAfterCommitRafRef.current);
    resetAfterCommitRafRef.current = requestAnimationFrame(() => {
      resetAfterCommitRafRef.current = null;
      resetMotion();
      setSettlingTopCard(false);
    });
  }, [onCommitPick, resetMotion]);

  const startPickTransition = React.useCallback(
    (pick: Pick) => {
      const currentDeck = deckRef.current;
      const current = currentDeck.current;
      if (!current || disabled || transition || isAnimatingSV.value) return;

      setCardFlipped(false);
      const nextPicks = {
        ...localPicksRef.current,
        [current.fixture.fixture_index]: pick,
      };
      const promoted = currentDeck.next;
      const nextDeck = promoted
        ? buildDeckCards(fixturesRef.current, formsByFixtureIndexRef.current, nextPicks, promoted.index)
        : { current: null, next: null, queued: null };

      const transitionState: Exclude<TransitionState, null> = {
        outgoing: current,
        nextPicks,
        pick,
      };

      setLocalPicks(nextPicks);
      setDeck(nextDeck);
      setTransition(transitionState);

      isAnimatingSV.value = 1;
      const startX = tx.value;
      const startY = ty.value;
      const offX = pick === 'H' ? -screenWidth * 1.12 : pick === 'A' ? screenWidth * 1.12 : 0;
      const offY = pick === 'D' ? screenHeight * 1.02 : 0;
      const easing = Easing.bezier(0.2, 0.8, 0.2, 1);

      tx.value = withTiming(startX + offX, { duration: 240, easing });
      ty.value = withTiming(startY + offY, { duration: 240, easing });
      opacity.value = withTiming(0, { duration: 220, easing });
      revealProgress.value = withTiming(1, { duration: 240, easing });
      scale.value = withTiming(0.96, { duration: 240, easing }, (finished) => {
        if (!finished) return;
        runOnJS(finalizePickTransition)(transitionState);
      });
    },
    [disabled, finalizePickTransition, isAnimatingSV, opacity, revealProgress, scale, screenHeight, screenWidth, transition, tx, ty]
  );

  const gesture = React.useMemo(() => {
    const pan = Gesture.Pan()
      .enabled(!disabled && !transition)
      .maxPointers(1)
      .runOnJS(false)
      .onUpdate((e) => {
        if (disabled || transition || isAnimatingSV.value) return;
        tx.value = e.translationX;
        ty.value = e.translationY;
        const absX = Math.abs(e.translationX);
        const absY = Math.abs(e.translationY);
        const progressThreshold = absY > absX ? DRAW_SWIPE_THRESHOLD : SWIPE_THRESHOLD;
        revealProgress.value = Math.min(1, Math.max(absX, absY) / progressThreshold);
      })
      .onEnd((e) => {
        if (disabled || transition || isAnimatingSV.value) return;
        const dx = e.translationX ?? 0;
        const dy = e.translationY ?? 0;
        const absX = Math.abs(dx);
        const absY = Math.abs(dy);

        let pick: Pick | null = null;
        if (absX >= SWIPE_THRESHOLD && absX > absY * DIRECTION_RATIO) pick = dx > 0 ? 'A' : 'H';
        else if (dy >= DRAW_SWIPE_THRESHOLD && dy > absX * DIRECTION_RATIO) pick = 'D';

        if (pick) {
          runOnJS(startPickTransition)(pick);
          return;
        }

        tx.value = withSpring(0, RESET_SPRING);
        ty.value = withSpring(0, RESET_SPRING);
        revealProgress.value = withSpring(0, RESET_SPRING);
      });

    if (!enableCardFlip) return pan;

    const tap = Gesture.Tap()
      .enabled(!disabled && !transition)
      .maxDuration(280)
      .onEnd(() => {
        runOnJS(toggleCardFlip)();
      });

    // Tap has priority for short presses; pan wins once movement starts.
    return Gesture.Exclusive(tap, pan);
  }, [
    disabled,
    enableCardFlip,
    isAnimatingSV,
    revealProgress,
    startPickTransition,
    toggleCardFlip,
    transition,
    tx,
    ty,
  ]);

  const pressableOpacity = (pressed: boolean) => {
    if (disabled || !currentCard || !!transition || settlingTopCard) return 0.55;
    return pressed ? 0.92 : 1;
  };

  if (!currentCard) return null;

  const visibleNextCard = deck.next;
  const visibleQueuedCard = deck.queued;

  return (
    <>
      <GestureDetector gesture={gesture}>
        <View style={{ width: cardWidth, height: cardWidth / 0.75 }}>
          {visibleQueuedCard ? (
            <Animated.View
              key={`queued-${visibleQueuedCard.fixture.fixture_index}`}
              pointerEvents="none"
              style={[
                {
                  position: 'absolute',
                  inset: 0,
                  zIndex: 1,
                },
                queuedCardStyle,
              ]}
            >
              <SwipePredictionCard
                fixture={visibleQueuedCard.fixture}
                showSwipeHint={false}
                homeForm={visibleQueuedCard.forms.home}
                awayForm={visibleQueuedCard.forms.away}
              />
            </Animated.View>
          ) : null}

          {visibleNextCard ? (
            <Animated.View
              key={`next-${visibleNextCard.fixture.fixture_index}`}
              pointerEvents="none"
              style={[
                {
                  position: 'absolute',
                  inset: 0,
                  zIndex: 2,
                },
                promotedCardStyle,
              ]}
            >
              <SwipePredictionCard
                fixture={visibleNextCard.fixture}
                showSwipeHint={false}
                homeForm={visibleNextCard.forms.home}
                awayForm={visibleNextCard.forms.away}
              />
            </Animated.View>
          ) : null}

          {deck.current ? (
            settlingTopCard || transition ? (
              <View
                key={`current-static-${deck.current.fixture.fixture_index}`}
                style={{
                  position: 'absolute',
                  inset: 0,
                  zIndex: 3,
                }}
              >
                {renderCard(deck.current, { showSwipeHint: true, flipped: false })}
              </View>
            ) : (
              <Animated.View
                key={`current-animated-${deck.current.fixture.fixture_index}`}
                style={[
                  {
                    position: 'absolute',
                    inset: 0,
                    zIndex: 3,
                  },
                  topCardStyle,
                ]}
              >
                {renderCard(deck.current, { showSwipeHint: true, flipped: cardFlipped })}
              </Animated.View>
            )
          ) : null}

          {transition ? (
            <Animated.View
              key={`outgoing-${transition.outgoing.fixture.fixture_index}`}
              style={[
                {
                  position: 'absolute',
                  inset: 0,
                  zIndex: 4,
                },
                topCardStyle,
              ]}
            >
              {renderCard(transition.outgoing, { showSwipeHint: true, flipped: false })}
            </Animated.View>
          ) : null}
        </View>
      </GestureDetector>

      {enableCardFlip ? (
        <FlipHintLabel
          flipped={cardFlipped}
          pulseKey={deck.current?.fixture.fixture_index ?? 'none'}
          tx={tx}
          ty={ty}
          hidden={!!transition || settlingTopCard || flipAnimating}
        />
      ) : null}

      <View style={{ height: enableCardFlip ? 18 : 32 }} />

      <View style={{ width: '100%' }}>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Animated.View style={[{ flex: 1 }, homeWrapStyle]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Home win"
              disabled={disabled || !!transition || settlingTopCard}
              onPress={() => void startPickTransition('H')}
              style={({ pressed }) => ({
                height: 58,
                borderRadius: 18,
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                opacity: pressableOpacity(pressed),
              })}
            >
              <Animated.View style={[StyleSheet.absoluteFillObject, homeBtnStyle]} />
              <Animated.Text
                style={[
                  {
                    fontFamily: 'Gramatika-Medium',
                    fontStyle: 'normal',
                    fontWeight: '500',
                    fontSize: 14,
                    lineHeight: 17,
                    textAlign: 'center',
                    letterSpacing: -0.004,
                  },
                  homeTextStyle,
                ] as any}
              >
                Home Win
              </Animated.Text>
            </Pressable>
          </Animated.View>

          <Animated.View style={[{ flex: 1 }, drawWrapStyle]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Draw"
              disabled={disabled || !!transition || settlingTopCard}
              onPress={() => void startPickTransition('D')}
              style={({ pressed }) => ({
                height: 58,
                borderRadius: 18,
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                opacity: pressableOpacity(pressed),
              })}
            >
              <Animated.View style={[StyleSheet.absoluteFillObject, drawBtnStyle]} />
              <Animated.Text
                style={[
                  {
                    fontFamily: 'Gramatika-Medium',
                    fontStyle: 'normal',
                    fontWeight: '500',
                    fontSize: 14,
                    lineHeight: 17,
                    textAlign: 'center',
                    letterSpacing: -0.004,
                  },
                  drawTextStyle,
                ] as any}
              >
                Draw
              </Animated.Text>
            </Pressable>
          </Animated.View>

          <Animated.View style={[{ flex: 1 }, awayWrapStyle]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Away win"
              disabled={disabled || !!transition || settlingTopCard}
              onPress={() => void startPickTransition('A')}
              style={({ pressed }) => ({
                height: 58,
                borderRadius: 18,
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                opacity: pressableOpacity(pressed),
              })}
            >
              <Animated.View style={[StyleSheet.absoluteFillObject, awayBtnStyle]} />
              <Animated.Text
                style={[
                  {
                    fontFamily: 'Gramatika-Medium',
                    fontStyle: 'normal',
                    fontWeight: '500',
                    fontSize: 14,
                    lineHeight: 17,
                    textAlign: 'center',
                    letterSpacing: -0.004,
                  },
                  awayTextStyle,
                ] as any}
              >
                Away Win
              </Animated.Text>
            </Pressable>
          </Animated.View>
        </View>
      </View>
    </>
  );
}
