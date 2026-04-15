import React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import type { Fixture, Pick } from '@totl/domain';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { TotlText } from '@totl/ui';
import ViewShot from 'react-native-view-shot';

import SwipePredictionCard from './SwipePredictionCard';

type FixtureForms = { home: string | null; away: string | null };
type CardSnapshot = {
  index: number;
  fixture: Fixture;
  forms: FixtureForms;
};

function isPick(v: unknown): v is Pick {
  return v === 'H' || v === 'D' || v === 'A';
}

function findNextUnpickedIndex(fixtures: Fixture[], picks: Record<number, Pick>, currentIndex: number): number {
  return fixtures.findIndex((f, i) => i > currentIndex && !isPick(picks[f.fixture_index]));
}

const EMPTY_FIXTURE_FORMS: FixtureForms = { home: null, away: null };
const ACTIVE_BG = '#1C8376';
const INACTIVE_BG = '#E6F3F0';
const ACTIVE_TEXT = '#FFFFFF';
const INACTIVE_TEXT = '#0F172A';

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
}) {
  const initialCardIndex = React.useMemo(() => {
    if (!fixtures.length) return 0;
    const idx = fixtures.findIndex((f) => !isPick(picks[f.fixture_index]));
    return idx >= 0 ? idx : Math.max(0, fixtures.length - 1);
  }, [fixtures, picks]);
  const deckIdentity = React.useMemo(
    () => fixtures.map((fixture) => `${String(fixture.id)}:${fixture.fixture_index}`).join('|'),
    [fixtures]
  );

  const [currentCard, setCurrentCard] = React.useState<CardSnapshot | null>(() =>
    buildCardSnapshot(fixtures, formsByFixtureIndex, initialCardIndex)
  );
  const [overlayImageUri, setOverlayImageUri] = React.useState<string | null>(null);
  const lastDeckIdentityRef = React.useRef<string | null>(null);

  const fixturesRef = React.useRef(fixtures);
  const picksRef = React.useRef(picks);
  const formsByFixtureIndexRef = React.useRef(formsByFixtureIndex);
  const currentCardRef = React.useRef<CardSnapshot | null>(currentCard);
  const currentCardCaptureUriRef = React.useRef<string | null>(null);
  const cardShotRef = React.useRef<ViewShot | null>(null);
  const commitRafRef = React.useRef<number | null>(null);
  const animationStartRafRef = React.useRef<number | null>(null);
  const captureRaf1Ref = React.useRef<number | null>(null);
  const captureRaf2Ref = React.useRef<number | null>(null);

  React.useEffect(() => {
    fixturesRef.current = fixtures;
  }, [fixtures]);

  React.useEffect(() => {
    picksRef.current = picks;
  }, [picks]);

  React.useEffect(() => {
    formsByFixtureIndexRef.current = formsByFixtureIndex;
  }, [formsByFixtureIndex]);

  React.useEffect(() => {
    currentCardRef.current = currentCard;
    onCurrentIndexChange?.(currentCard?.index ?? 0);
  }, [currentCard, onCurrentIndexChange]);

  React.useEffect(() => {
    if (lastDeckIdentityRef.current === deckIdentity) return;
    lastDeckIdentityRef.current = deckIdentity;
    setOverlayImageUri(null);
    currentCardCaptureUriRef.current = null;
    setCurrentCard(buildCardSnapshot(fixtures, formsByFixtureIndex, initialCardIndex));
  }, [deckIdentity, fixtures, formsByFixtureIndex, initialCardIndex]);

  React.useEffect(() => {
    return () => {
      if (commitRafRef.current) cancelAnimationFrame(commitRafRef.current);
      if (animationStartRafRef.current) cancelAnimationFrame(animationStartRafRef.current);
      if (captureRaf1Ref.current) cancelAnimationFrame(captureRaf1Ref.current);
      if (captureRaf2Ref.current) cancelAnimationFrame(captureRaf2Ref.current);
    };
  }, []);

  const captureCurrentCard = React.useCallback(async (): Promise<string | null> => {
    const viewShot = cardShotRef.current as unknown as { capture?: () => Promise<string> } | null;
    if (!viewShot?.capture) return null;
    try {
      const uri = await viewShot.capture();
      currentCardCaptureUriRef.current = uri ?? null;
      return uri ?? null;
    } catch {
      return currentCardCaptureUriRef.current;
    }
  }, []);

  React.useEffect(() => {
    currentCardCaptureUriRef.current = null;
    if (!currentCard || overlayImageUri) return;

    let cancelled = false;
    captureRaf1Ref.current = requestAnimationFrame(() => {
      captureRaf2Ref.current = requestAnimationFrame(() => {
        void (async () => {
          if (cancelled) return;
          await captureCurrentCard();
        })();
      });
    });

    return () => {
      cancelled = true;
      if (captureRaf1Ref.current) cancelAnimationFrame(captureRaf1Ref.current);
      if (captureRaf2Ref.current) cancelAnimationFrame(captureRaf2Ref.current);
    };
  }, [captureCurrentCard, currentCard?.fixture.fixture_index, overlayImageUri]);

  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);
  const isAnimatingSV = useSharedValue(0);

  const resetMotion = React.useCallback(() => {
    tx.value = 0;
    ty.value = 0;
    opacity.value = 1;
    scale.value = 1;
    isAnimatingSV.value = 0;
  }, [isAnimatingSV, opacity, scale, tx, ty]);

  const overlayImageStyle = useAnimatedStyle(() => {
    const rotate = `${(tx.value / Math.max(1, screenWidth)) * 18}deg`;
    return {
      opacity: opacity.value,
      transform: [{ translateX: tx.value }, { translateY: ty.value }, { rotateZ: rotate }, { scale: scale.value }],
    };
  }, [screenWidth]);

  const liveCardStyle = useAnimatedStyle(() => {
    const rotate = `${(tx.value / Math.max(1, screenWidth)) * 18}deg`;
    return {
      transform: [{ translateX: tx.value }, { translateY: ty.value }, { rotateZ: rotate }],
    };
  }, [screenWidth]);

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

  const finishTransition = React.useCallback(() => {
    resetMotion();
    setOverlayImageUri(null);
  }, [resetMotion]);

  const startPickTransition = React.useCallback(
    async (pick: Pick) => {
      const current = currentCardRef.current;
      if (!current || disabled || isAnimatingSV.value || overlayImageUri) return;

      let snapshotUri = currentCardCaptureUriRef.current;
      if (!snapshotUri) snapshotUri = await captureCurrentCard();
      if (!snapshotUri) return;

      const nextPicks = { ...picksRef.current, [current.fixture.fixture_index]: pick };
      const nextIndex = findNextUnpickedIndex(fixturesRef.current, nextPicks, current.index);
      const nextCard =
        nextIndex >= 0
          ? buildCardSnapshot(fixturesRef.current, formsByFixtureIndexRef.current, nextIndex)
          : current;

      if (commitRafRef.current) cancelAnimationFrame(commitRafRef.current);
      if (animationStartRafRef.current) cancelAnimationFrame(animationStartRafRef.current);

      setOverlayImageUri(snapshotUri);
      setCurrentCard(nextCard);

      commitRafRef.current = requestAnimationFrame(() => {
        onCommitPick(current.fixture.fixture_index, pick);
      });

      animationStartRafRef.current = requestAnimationFrame(() => {
        isAnimatingSV.value = 1;

        const startX = tx.value;
        const startY = ty.value;
        const offX = pick === 'H' ? -screenWidth * 1.1 : pick === 'A' ? screenWidth * 1.1 : 0;
        const offY = pick === 'D' ? screenHeight * 1.05 : 0;
        const easing = Easing.bezier(0.2, 0.8, 0.2, 1);

        tx.value = withTiming(startX + offX, { duration: 230, easing });
        ty.value = withTiming(startY + offY, { duration: 230, easing });
        opacity.value = withTiming(0, { duration: 210, easing });
        scale.value = withTiming(0.94, { duration: 230, easing }, (finished) => {
          if (!finished) return;
          runOnJS(finishTransition)();
        });
      });
    },
    [captureCurrentCard, disabled, finishTransition, isAnimatingSV, onCommitPick, opacity, overlayImageUri, scale, screenHeight, screenWidth, tx, ty]
  );

  const gesture = React.useMemo(() => {
    const THRESHOLD = 110;
    const DIRECTION_RATIO = 1.2;

    return Gesture.Pan()
      .enabled(!disabled && !overlayImageUri)
      .maxPointers(1)
      .runOnJS(false)
      .onUpdate((e) => {
        if (disabled || isAnimatingSV.value || overlayImageUri) return;
        tx.value = e.translationX;
        ty.value = e.translationY;
      })
      .onEnd((e) => {
        if (disabled || isAnimatingSV.value || overlayImageUri) return;
        const dx = e.translationX ?? 0;
        const dy = e.translationY ?? 0;
        const absX = Math.abs(dx);
        const absY = Math.abs(dy);

        let pick: Pick | null = null;
        if (absX >= THRESHOLD && absX > absY * DIRECTION_RATIO) pick = dx > 0 ? 'A' : 'H';
        else if (dy >= THRESHOLD && dy > absX) pick = 'D';

        if (pick) {
          runOnJS(startPickTransition)(pick);
          return;
        }

        tx.value = withTiming(0, { duration: 180, easing: Easing.out(Easing.cubic) });
        ty.value = withTiming(0, { duration: 180, easing: Easing.out(Easing.cubic) });
      });
  }, [disabled, isAnimatingSV, overlayImageUri, startPickTransition, tx, ty]);

  const pressableOpacity = (pressed: boolean) => {
    if (disabled || !currentCard || !!overlayImageUri) return 0.55;
    return pressed ? 0.92 : 1;
  };

  const nextPreviewCard = React.useMemo(() => {
    if (!currentCard) return null;
    const nextIndex = findNextUnpickedIndex(fixtures, picks, currentCard.index);
    return buildCardSnapshot(fixtures, formsByFixtureIndex, nextIndex);
  }, [currentCard, fixtures, formsByFixtureIndex, picks]);

  if (!currentCard) return null;

  return (
    <>
      <View style={{ width: cardWidth, height: cardWidth / 0.75 }}>
        {nextPreviewCard ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              inset: 0,
              opacity: 0.82,
              transform: [{ translateY: 12 }, { scale: 0.965 }],
            }}
          >
            <SwipePredictionCard
              fixture={nextPreviewCard.fixture}
              showSwipeHint={false}
              homeForm={nextPreviewCard.forms.home}
              awayForm={nextPreviewCard.forms.away}
            />
          </View>
        ) : null}

        {overlayImageUri ? (
          <View style={{ flex: 1 }}>
            <ViewShot
              ref={cardShotRef}
              options={{ format: 'jpg', quality: 0.9, result: 'tmpfile' }}
              style={{ flex: 1 }}
            >
              <SwipePredictionCard
                fixture={currentCard.fixture}
                showSwipeHint={false}
                homeForm={currentCard.forms.home}
                awayForm={currentCard.forms.away}
              />
            </ViewShot>
          </View>
        ) : (
          <GestureDetector gesture={gesture}>
            <Animated.View style={[{ flex: 1 }, liveCardStyle]}>
              <ViewShot
                ref={cardShotRef}
                options={{ format: 'jpg', quality: 0.9, result: 'tmpfile' }}
                style={{ flex: 1 }}
              >
                <SwipePredictionCard
                  fixture={currentCard.fixture}
                  showSwipeHint
                  homeForm={currentCard.forms.home}
                  awayForm={currentCard.forms.away}
                />
              </ViewShot>
            </Animated.View>
          </GestureDetector>
        )}

        {overlayImageUri ? (
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: 'absolute',
                inset: 0,
              },
              overlayImageStyle,
            ]}
          >
            <Image
              source={{ uri: overlayImageUri }}
              style={{ width: '100%', height: '100%', borderRadius: 28 }}
              resizeMode="cover"
            />
          </Animated.View>
        ) : null}
      </View>

      <View style={{ height: 32 }} />

      <View style={{ width: '100%' }}>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Animated.View style={[{ flex: 1 }, homeWrapStyle]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Home win"
              disabled={disabled || !!overlayImageUri}
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
              disabled={disabled || !!overlayImageUri}
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
              disabled={disabled || !!overlayImageUri}
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
