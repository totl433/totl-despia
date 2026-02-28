import React from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute, useScrollToTop } from '@react-navigation/native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Fixture, Pick } from '@totl/domain';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, {
  Easing,
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Button, Card, Screen, TotlText, useTokens } from '@totl/ui';

import { api } from '../lib/api';
import { TotlRefreshControl } from '../lib/refreshControl';
import { usePredictionsData } from '../hooks/usePredictionsData';
import FixtureCard from '../components/FixtureCard';
import SwipePredictionCard from '../components/predictions/SwipePredictionCard';
import PredictionsProgressPills from '../components/predictions/PredictionsProgressPills';
import PredictionsHowToSheet from '../components/predictions/PredictionsHowToSheet';
import { useConfetti } from '../lib/confetti';
import AppTopHeader from '../components/AppTopHeader';
import CenteredSpinner from '../components/CenteredSpinner';
import { FLOATING_TAB_BAR_SCROLL_BOTTOM_PADDING } from '../lib/layout';

type Mode = 'cards' | 'review' | 'list';

const FLAT_CARD_STYLE = {
  shadowOpacity: 0,
  shadowRadius: 0,
  shadowOffset: { width: 0, height: 0 },
  elevation: 0,
} as const;

const HOW_TO_STORAGE_KEY = 'predictionsSwipeFirstVisit';
const REVIEW_TIP_STORAGE_KEY = 'predictionsReviewTipDismissed:v1';

function isPick(v: unknown): v is Pick {
  return v === 'H' || v === 'D' || v === 'A';
}

function PickChip({
  label,
  active,
  disabled,
  onPress,
}: {
  label: string;
  active: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const t = useTokens();
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        height: 48,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: active ? t.color.brand : t.color.surface2,
        opacity: disabled ? 0.5 : pressed ? 0.92 : 1,
        transform: [{ scale: pressed ? 0.99 : 1 }],
      })}
    >
      <TotlText style={{ color: active ? '#FFFFFF' : t.color.text, fontFamily: t.font.medium }}>{label}</TotlText>
    </Pressable>
  );
}

export default function PredictionsScreen() {
  const t = useTokens();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const isTestMode = route?.name === 'PredictionsTestFlow';
  const scrollRef = React.useRef<any>(null);
  useScrollToTop(scrollRef);
  const queryClient = useQueryClient();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const confetti = useConfetti();

  const {
    avatarUrl,
    fixtures,
    fixturesByDate,
    gw,
    submitted,
    effectiveData,
    formsByFixtureIndex,
    picks,
    setPickLocal,
    deadline,
    deadlineExpired,
    allPicksMade,
    isLoading,
    error,
    refetch,
  } = usePredictionsData({ isTestMode });

  const [howToSuppressed, setHowToSuppressed] = React.useState<boolean>(false);
  const [howToOpen, setHowToOpen] = React.useState(false);
  const howToShownThisSessionRef = React.useRef(false);
  const [confirmError, setConfirmError] = React.useState<string | null>(null);
  const [reviewTipDismissed, setReviewTipDismissed] = React.useState<boolean>(false);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const v = await AsyncStorage.getItem(HOW_TO_STORAGE_KEY);
        if (!alive) return;
        setHowToSuppressed(v === 'true');
      } catch {
        // ignore
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const v = await AsyncStorage.getItem(REVIEW_TIP_STORAGE_KEY);
        if (!alive) return;
        setReviewTipDismissed(v === 'true');
      } catch {
        // ignore
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const forceListMode = submitted || deadlineExpired;
  const [mode, setMode] = React.useState<Mode>('list');

  React.useEffect(() => {
    if (forceListMode) {
      if (mode !== 'list') setMode('list');
      return;
    }
    // Default UX: cards until complete, then review.
    if (allPicksMade) {
      if (mode === 'cards') setMode('review');
      if (mode === 'list') setMode('review');
      return;
    }
    if (mode === 'list') setMode('cards');
  }, [allPicksMade, forceListMode, mode]);

  // Bottom tab bar behavior:
  // - Hide while making/reviewing picks (full-screen flow).
  // - Show once picks are submitted (normal screen with bottom nav).
  React.useEffect(() => {
    const hideTabBar = mode !== 'list';
    // @bottom-tabs/react-navigation doesn't reliably support `tabBarStyle: { display: 'none' }`
    // for fully hiding the native bar. Instead, we communicate intent via route params and let
    // our custom `FloatingTabBar` decide whether to render.
    navigation.setParams?.({ hideTabBar });
  }, [mode, navigation]);

  React.useEffect(() => {
    // Show the “how to swipe” sheet once, only when swipe mode is actually available.
    if (howToSuppressed) return;
    if (howToShownThisSessionRef.current) return;
    if (mode !== 'cards') return;
    if (forceListMode) return;
    if (!fixtures.length) return;

    howToShownThisSessionRef.current = true;
    const id = setTimeout(() => setHowToOpen(true), 250);
    return () => clearTimeout(id);
  }, [fixtures.length, forceListMode, howToSuppressed, mode]);

  const initialCardIndex = React.useMemo(() => {
    if (!fixtures.length) return 0;
    const idx = fixtures.findIndex((f) => !isPick(picks[f.fixture_index]));
    return idx >= 0 ? idx : Math.max(0, fixtures.length - 1);
  }, [fixtures, picks]);

  const [cardIndex, setCardIndex] = React.useState(0);
  React.useEffect(() => {
    setCardIndex(initialCardIndex);
  }, [initialCardIndex]);
  const nextUnpickedCardIndex = React.useMemo(() => {
    return fixtures.findIndex((f, i) => i > cardIndex && !isPick(picks[f.fixture_index]));
  }, [cardIndex, fixtures, picks]);

  const setPickLocal = React.useCallback(
    (fixture_index: number, pick: Pick) => {
      if (submitted || deadlineExpired) return;
      setDraftPicks((prev) => ({ ...prev, [fixture_index]: pick }));
    },
    [deadlineExpired, submitted]
  );

  const confirmMutation = useMutation({
    mutationFn: async () => {
      setConfirmError(null);
      if (submitted) throw new Error('Already submitted');
      if (deadlineExpired) throw new Error('Deadline has passed');
      if (typeof gw !== 'number') throw new Error('Missing gameweek');
      if (!fixtures.length) throw new Error('No fixtures');
      if (isTestMode) return { gw: 99 };

      // Ensure we have a pick for every fixture.
      const picksArray = fixtures.map((f) => {
        const pick = picks[f.fixture_index];
        if (!isPick(pick)) throw new Error('Please complete all predictions');
        return { fixture_index: f.fixture_index, pick };
      });

      await api.savePredictions({ gw, picks: picksArray });
      await api.submitPredictions({ gw });
      return { gw };
    },
    onSuccess: async () => {
      if (isTestMode) {
        requestAnimationFrame(() => {
          if (navigation?.canGoBack?.()) navigation.goBack();
        });
        return;
      }
      // Draft cleared by hook when submitted becomes true after refetch.
      confetti.fire({
        origin: { x: screenWidth / 2, y: -10 },
        count: 300,
        explosionSpeed: 460,
        fallSpeed: 3000,
        ttlMs: 2800,
      });

      // Refetch key screens so Home reflects "locked in" immediately.
      await Promise.allSettled([
        queryClient.invalidateQueries({ queryKey: ['predictions'] }),
        queryClient.invalidateQueries({ queryKey: ['homeSnapshot'] }),
        queryClient.invalidateQueries({ queryKey: ['homeRanks'] }),
      ]);

      // Navigate on next frame so the overlay is mounted before the tab switch.
      requestAnimationFrame(() => {
        if (navigation?.canGoBack?.()) {
          navigation.goBack();
          return;
        }
        navigation.navigate('Tabs', { screen: 'Predictions' });
      });
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : 'Failed to confirm predictions';
      setConfirmError(msg);
    },
  });

  const renderGroupedFixtures = React.useCallback(
    ({ interactive }: { interactive: boolean }) => {
      return fixturesByDate.map((g, groupIdx) => (
        <View
          key={`${g.date}-${groupIdx}`}
          style={{ marginBottom: groupIdx === fixturesByDate.length - 1 ? 0 : 12 }}
        >
          <Card style={[FLAT_CARD_STYLE, { padding: 0 }]}>
            <View style={{ borderRadius: 22, overflow: 'hidden' }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingHorizontal: 16,
                  paddingTop: 14,
                  paddingBottom: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: t.color.border,
                }}
              >
                <TotlText
                  style={{
                    color: t.color.text,
                    fontSize: 14,
                    lineHeight: 14,
                    letterSpacing: 0.6,
                  }}
                  numberOfLines={1}
                >
                  {String(g.date ?? '').toUpperCase()}
                </TotlText>
              </View>

              {g.fixtures.map((f: Fixture, idx: number) => {
                const pick = picks[f.fixture_index] ?? undefined;
                return (
                  <View key={String(f.id)} style={{ position: 'relative' }}>
                    {idx < g.fixtures.length - 1 ? (
                      <View
                        style={{
                          position: 'absolute',
                          left: 16,
                          right: 16,
                          bottom: 0,
                          height: 1,
                          backgroundColor: t.color.border,
                          zIndex: 2,
                        }}
                      />
                    ) : null}
                    <FixtureCard
                      fixture={f as any}
                      liveScore={null}
                      pick={pick as any}
                      showPickButtons
                      pickButtonsDisabled={!interactive || submitted || deadlineExpired}
                      onPick={interactive ? (side) => setPickLocal(f.fixture_index, side) : undefined}
                      variant="grouped"
                    />
                  </View>
                );
              })}
            </View>
          </Card>
        </View>
      ));
    },
    [deadlineExpired, fixturesByDate, picks, setPickLocal, submitted, t.color.text]
  );

  const renderTopBar = ({ title }: { title: string }) => (
    <AppTopHeader
      onPressChat={() => navigation.navigate('ChatHub')}
      onPressProfile={() => navigation.navigate('Profile')}
      avatarUrl={avatarUrl}
      title={title}
    />
  );

  // --- Swipe deck animation state ---
  const isAnimatingSV = useSharedValue(0);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);

  // IMPORTANT: Smooth card-to-card transitions.
  // Reset shared values only AFTER React has swapped the card (cardIndex/mode changes),
  // otherwise the outgoing card can “snap back” for a frame (jitter) at the end of the animation.
  React.useEffect(() => {
    if (mode !== 'cards') {
      tx.value = 0;
      ty.value = 0;
      opacity.value = 1;
      scale.value = 1;
      isAnimatingSV.value = 0;
      return;
    }
    tx.value = 0;
    ty.value = 0;
    opacity.value = 1;
    scale.value = 1;
    isAnimatingSV.value = 0;
  }, [cardIndex, isAnimatingSV, mode, opacity, scale, tx, ty]);

  const cardStyle = useAnimatedStyle(() => {
    const rotate = `${(tx.value / Math.max(1, screenWidth)) * 18}deg`;
    return {
      transform: [{ translateX: tx.value }, { translateY: ty.value }, { rotateZ: rotate }, { scale: scale.value }],
      opacity: opacity.value,
    };
  }, [screenWidth]);

  const nextCardStyle = useAnimatedStyle(() => {
    const absX = Math.abs(tx.value);
    const absY = Math.abs(ty.value);
    const p = Math.min(1, Math.max(absX, absY) / 140);
    return {
      opacity: 0.15 + 0.85 * p,
      transform: [{ scale: 0.985 + 0.015 * p }],
    };
  }, []);

  const ACTIVE_BG = t.color.brand;
  const INACTIVE_BG = t.color.surface2;
  const ACTIVE_TEXT = '#FFFFFF';
  const INACTIVE_TEXT = t.color.text;

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

  const pressableOpacity = (pressed: boolean, disabled: boolean) => {
    if (disabled) return 0.55;
    return pressed ? 0.92 : 1;
  };

  const commitPick = React.useCallback(
    (pick: Pick) => {
      const current = fixtures[cardIndex];
      if (!current) return;
      setPickLocal(current.fixture_index, pick);

      // Advance to next unpicked fixture or review.
      const nextIdx = fixtures.findIndex((f, i) => i > cardIndex && !isPick(picks[f.fixture_index]));
      if (nextIdx >= 0) {
        setCardIndex(nextIdx);
        return;
      }
      if (fixtures.every((f) => isPick({ ...picks, [current.fixture_index]: pick }[f.fixture_index]))) {
        setMode('review');
        return;
      }
      setCardIndex(Math.min(fixtures.length - 1, cardIndex + 1));
    },
    [cardIndex, fixtures, picks, setPickLocal]
  );

  const animateOut = React.useCallback(
    (pick: Pick) => {
      if (isAnimatingSV.value) return;
      isAnimatingSV.value = 1;

      const offX = pick === 'H' ? -screenWidth * 1.1 : pick === 'A' ? screenWidth * 1.1 : 0;
      const offY = pick === 'D' ? screenHeight * 1.1 : 0;

      const easing = Easing.bezier(0.2, 0.8, 0.2, 1);
      tx.value = withTiming(offX, { duration: 260, easing });
      ty.value = withTiming(offY, { duration: 260, easing });
      opacity.value = withTiming(0, { duration: 240, easing });

      // NOTE: Do NOT reset shared values here (causes snap/jitter).
      // We let React swap the card via commitPick, then a useEffect resets values.
      scale.value = withTiming(0.92, { duration: 260, easing }, () => {
        runOnJS(commitPick)(pick);
      });
    },
    [commitPick, isAnimatingSV, opacity, scale, screenHeight, screenWidth, tx, ty]
  );

  const gesture = React.useMemo(() => {
    const THRESHOLD = 110;
    const DIRECTION_RATIO = 1.2;

    return Gesture.Pan()
      .maxPointers(1)
      .runOnJS(false)
      .onUpdate((e) => {
        if (isAnimatingSV.value) return;
        tx.value = e.translationX;
        ty.value = e.translationY;
      })
      .onEnd((e) => {
        if (isAnimatingSV.value) return;
        const dx = e.translationX ?? 0;
        const dy = e.translationY ?? 0;
        const absX = Math.abs(dx);
        const absY = Math.abs(dy);

        let pick: Pick | null = null;
        if (absX >= THRESHOLD && absX > absY * DIRECTION_RATIO) pick = dx > 0 ? 'A' : 'H';
        else if (dy >= THRESHOLD && dy > absX) pick = 'D';

        if (pick) {
          runOnJS(animateOut)(pick);
          return;
        }

        // Snap back.
        tx.value = withTiming(0, { duration: 180 });
        ty.value = withTiming(0, { duration: 180 });
      });
  }, [animateOut, isAnimatingSV, tx, ty]);

  const showInitialSpinner = isLoading && !effectiveData && !error;
  const onRefresh = React.useCallback(() => {
    if (isTestMode) return Promise.resolve();
    return refetch();
  }, [isTestMode, refetch]);

  // --- Render modes ---
  if (showInitialSpinner) {
    return (
      <Screen fullBleed>
        <CenteredSpinner loading />
      </Screen>
    );
  }

  if (mode === 'cards') {
    const current = fixtures[cardIndex] ?? null;
    const next = nextUnpickedCardIndex >= 0 ? (fixtures[nextUnpickedCardIndex] ?? null) : null;
    const cardWidth = Math.min(420, screenWidth - t.space[4] * 2);
    const currentForms = current ? formsByFixtureIndex.get(current.fixture_index) ?? { home: null, away: null } : null;
    const nextForms = next ? formsByFixtureIndex.get(next.fixture_index) ?? { home: null, away: null } : null;

    return (
      <Screen fullBleed>
        <PredictionsHowToSheet
          open={howToOpen}
          onClose={() => setHowToOpen(false)}
          onDontShowAgain={() => {
            setHowToSuppressed(true);
            setHowToOpen(false);
            void AsyncStorage.setItem(HOW_TO_STORAGE_KEY, 'true').catch(() => {});
          }}
        />
        {renderTopBar({
          title: isTestMode ? 'Make Your Predictions Test' : typeof gw === 'number' ? `Gameweek ${gw}` : 'Gameweek',
        })}

        <View style={{ paddingHorizontal: t.space[4], alignItems: 'center', marginTop: 16 }}>
          <View style={{ borderRadius: 999, backgroundColor: t.color.surface2, paddingHorizontal: 12 }}>
            <PredictionsProgressPills
              total={fixtures.length}
              currentIndex={cardIndex}
              hasPick={(idx) => {
                const f = fixtures[idx];
                if (!f) return false;
                return isPick(picks[f.fixture_index]);
              }}
            />
          </View>
        </View>

        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: t.space[4],
            paddingBottom: t.space[6],
          }}
        >
          {isLoading ? <TotlText variant="muted">Loading…</TotlText> : null}
          {error ? (
            <Card style={[FLAT_CARD_STYLE, { marginBottom: 12, width: '100%' }]}>
              <TotlText variant="heading" style={{ marginBottom: 6 }}>
                Couldn’t load predictions
              </TotlText>
              <TotlText variant="muted">{error instanceof Error ? error.message : String(error ?? 'Unknown error')}</TotlText>
            </Card>
          ) : null}

          {current ? (
            <View style={{ width: cardWidth, height: cardWidth / 0.75 }}>
              {next ? (
                <Animated.View
                  key={`next-${String(next.id)}-${next.fixture_index}`}
                  style={[{ position: 'absolute', inset: 0 }, nextCardStyle]}
                >
                  <SwipePredictionCard
                    fixture={next}
                    showSwipeHint={false}
                    homeForm={nextForms?.home ?? null}
                    awayForm={nextForms?.away ?? null}
                  />
                </Animated.View>
              ) : null}

              <GestureDetector gesture={gesture}>
                <Animated.View
                  key={`current-${String(current.id)}-${current.fixture_index}`}
                  style={[{ position: 'absolute', inset: 0 }, cardStyle]}
                >
                  <SwipePredictionCard
                    fixture={current}
                    showSwipeHint
                    homeForm={currentForms?.home ?? null}
                    awayForm={currentForms?.away ?? null}
                  />
                </Animated.View>
              </GestureDetector>
            </View>
          ) : (
            <Card style={[FLAT_CARD_STYLE, { width: '100%' }]}>
              <TotlText variant="heading" style={{ marginBottom: 6 }}>
                No fixtures yet
              </TotlText>
              <TotlText variant="muted">Pull to refresh.</TotlText>
            </Card>
          )}
          <View style={{ height: 32 }} />

          <View style={{ width: '100%' }}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Animated.View style={[{ flex: 1 }, homeWrapStyle]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Home win"
                  disabled={!current || submitted || deadlineExpired}
                  onPress={() => animateOut('H')}
                  style={({ pressed }) => ({
                    height: 58,
                    borderRadius: 18,
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    opacity: pressableOpacity(pressed, !current || submitted || deadlineExpired),
                  })}
                >
                  <Animated.View style={[StyleSheet.absoluteFillObject, homeBtnStyle]} />
                  <Animated.Text
                    style={[
                      {
                        fontStyle: 'normal',
                        fontFamily: t.font.medium,
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
                  disabled={!current || submitted || deadlineExpired}
                  onPress={() => animateOut('D')}
                  style={({ pressed }) => ({
                    height: 58,
                    borderRadius: 18,
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    opacity: pressableOpacity(pressed, !current || submitted || deadlineExpired),
                  })}
                >
                  <Animated.View style={[StyleSheet.absoluteFillObject, drawBtnStyle]} />
                  <Animated.Text
                    style={[
                      {
                        fontStyle: 'normal',
                        fontFamily: t.font.medium,
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
                  disabled={!current || submitted || deadlineExpired}
                  onPress={() => animateOut('A')}
                  style={({ pressed }) => ({
                    height: 58,
                    borderRadius: 18,
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    opacity: pressableOpacity(pressed, !current || submitted || deadlineExpired),
                  })}
                >
                  <Animated.View style={[StyleSheet.absoluteFillObject, awayBtnStyle]} />
                  <Animated.Text
                    style={[
                      {
                        fontStyle: 'normal',
                        fontFamily: t.font.medium,
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
        </View>
      </Screen>
    );
  }

  if (mode === 'review') {
    return (
      <Screen fullBleed>
        {renderTopBar({
          title: 'Review',
        })}

        <View style={{ flex: 1 }}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: t.space[4], paddingBottom: 140 }}
            refreshControl={<TotlRefreshControl refreshing={!isTestMode && isRefetching} onRefresh={onRefresh} />}
          >
            {!reviewTipDismissed ? (
              <View
                style={{
                  borderRadius: 22,
                  borderWidth: 1,
                  borderColor: t.color.border,
                  backgroundColor: t.color.surface,
                  paddingVertical: 14,
                  paddingHorizontal: 14,
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: 12,
                  marginBottom: 12,
                }}
              >
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 999,
                    backgroundColor: 'rgba(28,131,118,0.14)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: 2,
                  }}
                >
                  <TotlText style={{ color: t.color.brand, fontFamily: t.font.medium }}>!</TotlText>
                </View>

                <View style={{ flex: 1, paddingRight: 8 }}>
                  <TotlText style={{ fontFamily: t.font.medium, lineHeight: 20 }}>
                    Want to change anything? Tap a prediction to update it. Your picks lock in when you confirm.
                  </TotlText>
                </View>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Dismiss tip"
                  onPress={() => {
                    setReviewTipDismissed(true);
                    void AsyncStorage.setItem(REVIEW_TIP_STORAGE_KEY, 'true').catch(() => {});
                  }}
                  style={({ pressed }) => ({
                    padding: 6,
                    marginRight: -6,
                    marginTop: -2,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <TotlText style={{ color: 'rgba(100,116,139,0.7)', fontFamily: t.font.medium, fontSize: 18 }}>✕</TotlText>
                </Pressable>
              </View>
            ) : null}

            {confirmError ? (
              <Card style={[FLAT_CARD_STYLE, { marginBottom: 12 }]}>
                <TotlText variant="heading" style={{ marginBottom: 6 }}>
                  Couldn’t confirm yet
                </TotlText>
                <TotlText variant="muted">{confirmError}</TotlText>
              </Card>
            ) : null}

            {deadlineExpired ? (
              <Card style={[FLAT_CARD_STYLE, { marginBottom: 12 }]}>
                <TotlText variant="heading" style={{ marginBottom: 6 }}>
                  Deadline has passed
                </TotlText>
                <TotlText variant="muted">Predictions are no longer available for this gameweek.</TotlText>
              </Card>
            ) : null}

            {renderGroupedFixtures({ interactive: true })}
          </ScrollView>

          <View
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              paddingHorizontal: t.space[4],
              paddingTop: 12,
              paddingBottom: t.space[6],
              backgroundColor: t.color.surface,
              borderTopWidth: 1,
              borderTopColor: t.color.border,
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Confirm predictions"
              disabled={!allPicksMade || submitted || deadlineExpired || confirmMutation.isPending}
              onPress={() => confirmMutation.mutate()}
              style={({ pressed }) => ({
                height: 54,
                borderRadius: 16,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: allPicksMade ? t.color.brand : t.color.border,
                opacity: submitted || deadlineExpired || confirmMutation.isPending ? 0.55 : pressed ? 0.92 : 1,
              })}
            >
                <TotlText style={{ color: '#FFFFFF', fontFamily: t.font.medium }}>
                  {confirmMutation.isPending ? (isTestMode ? 'Finishing…' : 'Confirming…') : isTestMode ? 'Finish Test' : 'Confirm'}
                </TotlText>
            </Pressable>
          </View>
        </View>
      </Screen>
    );
  }

  // List mode (submitted or deadline passed)
  return (
    <Screen fullBleed>
      <AppTopHeader
        onPressChat={() => navigation.navigate('ChatHub')}
        onPressProfile={() => navigation.navigate('Profile')}
        avatarUrl={avatarUrl}
        title={isTestMode ? 'Make Your Predictions Test' : 'Predictions'}
      />

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        // Keep bottom padding consistent across tabbed pages so content isn't obscured by the floating tab bar.
        contentContainerStyle={{
          paddingHorizontal: t.space[4],
          paddingTop: t.space[4],
          paddingBottom: FLOATING_TAB_BAR_SCROLL_BOTTOM_PADDING,
        }}
        refreshControl={<TotlRefreshControl refreshing={!isTestMode && isRefetching} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? <TotlText variant="muted">Loading…</TotlText> : null}
        {error ? (
          <Card style={[FLAT_CARD_STYLE, { marginBottom: 12 }]}>
            <TotlText variant="heading" style={{ marginBottom: 6 }}>
              Couldn’t load predictions
            </TotlText>
            <TotlText variant="muted">{error instanceof Error ? error.message : String(error ?? 'Unknown error')}</TotlText>
          </Card>
        ) : null}

        {deadlineExpired && !submitted ? (
          <Card style={[FLAT_CARD_STYLE, { marginBottom: 12 }]}>
            <TotlText variant="heading" style={{ marginBottom: 6 }}>
              Deadline has passed
            </TotlText>
            <TotlText variant="muted">Predictions are no longer available.</TotlText>
          </Card>
        ) : null}

        {submitted ? (
          <Card style={[FLAT_CARD_STYLE, { marginBottom: 12 }]}>
            <TotlText variant="heading" style={{ marginBottom: 6 }}>
              Submitted
            </TotlText>
            <TotlText variant="muted">Your predictions are locked in.</TotlText>
          </Card>
        ) : null}

        {renderGroupedFixtures({ interactive: false })}
      </ScrollView>
    </Screen>
  );
}

