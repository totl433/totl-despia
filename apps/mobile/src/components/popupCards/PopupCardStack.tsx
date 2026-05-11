import React from 'react';
import { Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import ConfettiCannon from 'react-native-confetti-cannon';
import { TotlText } from '@totl/ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import PopupInfoCard from './PopupInfoCard';
import PopupCardShareTray from './PopupCardShareTray';
import type { PopupCardDescriptor } from './types';

const STACK_OFFSET_Y = 14;
const STACK_META_HEIGHT = 32;
const STACK_ACTION_HEIGHT = 64;
const SHAREABLE_CARD_KINDS = new Set([
  'resultsScoreSheet',
  'results',
  'personalWinner',
  'championMiniLeague',
  'championOverall',
]);

const CHAMPION_CARD_KINDS = new Set(['championMiniLeague', 'championOverall']);

/**
 * Totals split across many cannons — more particles + stagger reads fuller than one mega burst.
 */
const CHAMPION_CONFETTI_COUNT = 840;
const PERSONAL_WINNER_MONTHLY_CONFETTI_COUNT = 520;
const PERSONAL_WINNER_GW_CONFETTI_COUNT = 440;
/** Lower ms = faster burst / fall in react-native-confetti-cannon. */
const CHAMPION_CONFETTI_EXPLOSION_MS = 340;
const CHAMPION_CONFETTI_FALL_MS = 4800;
const PERSONAL_CONFETTI_EXPLOSION_MS = 430;
const PERSONAL_CONFETTI_FALL_MS = 3900;

/** Mini-league gold champion card — warm foil + champagne highlights. */
const CHAMPION_MINI_LEAGUE_CONFETTI_COLORS = ['#B45309', '#CA8A04', '#EAB308', '#FDE047', '#E2E8F0', '#F8FAFC', '#FFFFFF'];
/** Overall silver holo card — cool chrome, cyan/magenta/lilac prism flecks (matches PopupInfoCard foil). */
const CHAMPION_OVERALL_CONFETTI_COLORS = [
  '#f8fafc',
  '#f1f5f9',
  '#e2e8f0',
  '#cbd5e1',
  '#94a3b8',
  '#64748b',
  '#22d3ee',
  '#a5b4fc',
  '#c4b5fd',
  '#fbcfe8',
  '#e0f2fe',
  '#ffffff',
];

/**
 * Shard across several cannons for coverage; origins differ so arcs don’t stack as one tube.
 * Pieces use `bottom: 0` — never use positive origin Y (bottom-edge glitch row).
 * Stagger is 0 so everything fires as one burst (sequential delay reads as multiple batches).
 */
const CONFETTI_CANNON_COLS = 8;
const CONFETTI_CANNON_ROWS = 3;
const CONFETTI_CANNON_SLOTS = CONFETTI_CANNON_COLS * CONFETTI_CANNON_ROWS;
const CONFETTI_AUTO_START_STAGGER_MS = 0;
/** Max added to `confettiFallMs` from slot variance (`slot % 11` * 260 at slot 10). */
const CONFETTI_MAX_FALL_VARIANCE_MS = 10 * 260;

function splitConfettiCount(total: number, segments: number): number[] {
  if (segments <= 0) return [];
  const base = Math.floor(total / segments);
  const remainder = total % segments;
  return Array.from({ length: segments }, (_, i) => base + (i < remainder ? 1 : 0));
}

/** Wide X + varied negative Y across three “bands” above the frame (never positive — no bottom glitch row). */
function confettiOriginForSlot(slot: number, w: number): { x: number; y: number } {
  const cols = CONFETTI_CANNON_COLS;
  const col = slot % cols;
  const row = Math.floor(slot / cols);
  const jitterX = ((slot % 5) - 2) * 5;
  const rawX = ((col + 0.5) / cols) * w + jitterX;
  const x = Math.max(12, Math.min(w - 12, rawX));
  const lift = 9 + (slot % 15) * 2.9 + row * 14;
  const y = Math.max(-64, Math.min(-8, -lift));
  return { x, y };
}

function confettiExplosionMs(slot: number, champion: boolean): number {
  const base = champion ? CHAMPION_CONFETTI_EXPLOSION_MS : PERSONAL_CONFETTI_EXPLOSION_MS;
  return base + (slot % 5) * 22;
}

function confettiFallMs(slot: number, champion: boolean): number {
  const base = champion ? CHAMPION_CONFETTI_FALL_MS : PERSONAL_CONFETTI_FALL_MS;
  return base + (slot % 11) * 260;
}

function getStackSlotStyle(slot: number): { translateX: number; translateY: number; rotationDeg: number } {
  switch (slot) {
    case 1:
      return { translateX: 2, translateY: 5, rotationDeg: -0.12 };
    case 2:
      return { translateX: -1, translateY: 10, rotationDeg: 0.1 };
    case 3:
      return { translateX: 1, translateY: 15, rotationDeg: -0.06 };
    default:
      return { translateX: 0, translateY: 0, rotationDeg: 0 };
  }
}

function StackCard({
  card,
  cardWidth,
  cardHeight,
  horizontalInset,
  verticalInset,
  baseTranslateX,
  baseTranslateY,
  baseRotationDeg,
  isTopCard,
  isClosing,
  stackProgress,
  dismissProgress,
  onClose,
  onSwipeDismiss,
}: {
  card: PopupCardDescriptor;
  cardWidth: number;
  cardHeight: number;
  horizontalInset: number;
  verticalInset: number;
  baseTranslateX: number;
  baseTranslateY: number;
  baseRotationDeg: number;
  isTopCard: boolean;
  isClosing: boolean;
  stackProgress: SharedValue<number>;
  dismissProgress: SharedValue<number>;
  onClose: () => void;
  onSwipeDismiss: () => void;
}) {
  const dragTranslateX = useSharedValue(0);
  const dragTranslateY = useSharedValue(0);
  const dragRotationDeg = useSharedValue(0);
  const dragOpacity = useSharedValue(1);

  React.useEffect(() => {
    dragTranslateX.value = 0;
    dragTranslateY.value = 0;
    dragRotationDeg.value = 0;
    dragOpacity.value = 1;
  }, [card.id, dragOpacity, dragRotationDeg, dragTranslateX, dragTranslateY, isTopCard]);

  const gesture = React.useMemo(() => {
    const SWIPE_DISTANCE = 90;
    const SWIPE_VELOCITY = 700;

    return Gesture.Pan()
      .enabled(isTopCard && !isClosing)
      .maxPointers(1)
      .runOnJS(false)
      .onUpdate((event) => {
        if (!isTopCard || isClosing) return;
        const nextTranslateX = (event.translationX ?? 0) * 0.98;
        const nextTranslateY = (event.translationY ?? 0) * 0.92;
        dragTranslateX.value = nextTranslateX;
        dragTranslateY.value = nextTranslateY;
        dragRotationDeg.value = interpolate(nextTranslateX, [-cardWidth * 0.45, cardWidth * 0.45], [-7, 7]);
        dragOpacity.value = interpolate(Math.abs(nextTranslateX), [0, cardWidth * 0.7], [1, 0.78]);
      })
      .onEnd((event) => {
        if (!isTopCard || isClosing) return;
        const translateX = event.translationX ?? 0;
        const translateY = event.translationY ?? 0;
        const velocityX = event.velocityX ?? 0;
        const velocityY = event.velocityY ?? 0;
        const absX = Math.abs(translateX);
        const absY = Math.abs(translateY);
        const horizontalThrow = absX >= SWIPE_DISTANCE || Math.abs(velocityX) >= SWIPE_VELOCITY;
        const verticalThrow = absY >= SWIPE_DISTANCE || Math.abs(velocityY) >= SWIPE_VELOCITY;
        const shouldDismiss = horizontalThrow || verticalThrow;

        if (shouldDismiss) {
          const dismissHorizontally = absX >= absY;
          const targetX = dismissHorizontally ? (translateX >= 0 ? cardWidth + 72 : -cardWidth - 72) : translateX * 0.35;
          const targetY = dismissHorizontally ? translateY * 0.35 : translateY >= 0 ? cardHeight + 96 : -cardHeight - 96;
          const targetRotation = dismissHorizontally ? (translateX >= 0 ? 10 : -10) : translateY >= 0 ? 6 : -6;

          dragTranslateX.value = withTiming(targetX, { duration: 180, easing: Easing.in(Easing.cubic) });
          dragTranslateY.value = withTiming(targetY, { duration: 180, easing: Easing.in(Easing.cubic) });
          dragRotationDeg.value = withTiming(targetRotation, { duration: 180, easing: Easing.in(Easing.cubic) });
          dragOpacity.value = withTiming(0.7, { duration: 180, easing: Easing.in(Easing.cubic) }, (finished) => {
            if (!finished) return;
            runOnJS(onSwipeDismiss)();
          });
          return;
        }

        dragTranslateX.value = withTiming(0, { duration: 180, easing: Easing.out(Easing.cubic) });
        dragTranslateY.value = withTiming(0, { duration: 180, easing: Easing.out(Easing.cubic) });
        dragRotationDeg.value = withTiming(0, { duration: 180, easing: Easing.out(Easing.cubic) });
        dragOpacity.value = withTiming(1, { duration: 180, easing: Easing.out(Easing.cubic) });
      });
  }, [cardWidth, dragOpacity, dragRotationDeg, dragTranslateX, dragTranslateY, isClosing, isTopCard, onSwipeDismiss]);

  const animatedStyle = useAnimatedStyle(() => {
    const enterTranslateX = interpolate(stackProgress.value, [0, 1], [cardWidth + 48, baseTranslateX], Extrapolation.CLAMP);
    const closingTranslateX = interpolate(dismissProgress.value, [0, 1], [baseTranslateX, -cardWidth - 72], Extrapolation.CLAMP);
    const dragAdjustedTranslateX = enterTranslateX + (isTopCard ? dragTranslateX.value : 0);
    const translateX = isClosing ? closingTranslateX : dragAdjustedTranslateX;
    const translateY = baseTranslateY + (isTopCard ? dragTranslateY.value : 0);
    const rotateDeg = baseRotationDeg + (isTopCard ? dragRotationDeg.value : 0);
    const opacity = isClosing
      ? interpolate(dismissProgress.value, [0, 1], [1, 0.7], Extrapolation.CLAMP)
      : isTopCard
        ? dragOpacity.value
        : 1;

    return {
      opacity,
      transform: [{ translateX }, { translateY }, { rotateZ: `${rotateDeg}deg` }],
    };
  }, [baseRotationDeg, baseTranslateX, baseTranslateY, cardWidth, isClosing, isTopCard]);

  const cardNode = (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: horizontalInset,
          top: verticalInset,
          width: cardWidth,
          height: cardHeight,
        },
        animatedStyle,
      ]}
    >
      <View
        style={{
          flex: 1,
          borderRadius: 28,
          shadowColor: '#000000',
          shadowOpacity: isTopCard ? 0.24 : 0.14,
          shadowRadius: isTopCard ? 28 : 16,
          shadowOffset: { width: 0, height: isTopCard ? 16 : 10 },
          elevation: isTopCard ? 12 : 6,
        }}
      >
        <PopupInfoCard
          kind={card.kind}
          title={card.title}
          eventKey={card.eventKey}
          isTopCard={isTopCard}
          onClose={isTopCard ? onClose : undefined}
          secondaryActionLabel={card.secondaryActionLabel}
          onSecondaryAction={card.onSecondaryAction}
        />
      </View>
    </Animated.View>
  );

  if (!isTopCard) {
    return cardNode;
  }

  return <GestureDetector gesture={gesture}>{cardNode}</GestureDetector>;
}

export default function PopupCardStack({
  cards,
  visible,
  initialShareCardId,
  closeStackOnShareClose = false,
  onDismissTop,
  onCloseAll,
}: {
  cards: PopupCardDescriptor[];
  visible: boolean;
  initialShareCardId?: string;
  closeStackOnShareClose?: boolean;
  onDismissTop: () => void;
  onCloseAll: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [closingCardId, setClosingCardId] = React.useState<string | null>(null);
  const [shouldRender, setShouldRender] = React.useState(visible);
  const [shareCard, setShareCard] = React.useState<PopupCardDescriptor | null>(null);
  const [confettiShot, setConfettiShot] = React.useState<{
    key: number;
    cardId: string;
    monthly: boolean;
    champion?: boolean;
    championKind?: 'championMiniLeague' | 'championOverall';
  } | null>(null);
  const openedInitialShareCardIdRef = React.useRef<string | null>(null);
  const firedConfettiCardIdRef = React.useRef<string | null>(null);
  const slotAssignmentsRef = React.useRef<Record<string, number>>({});
  const stackProgress = useSharedValue(0);
  const overlayProgress = useSharedValue(0);
  const dismissProgress = useSharedValue(0);

  React.useEffect(() => {
    if (!visible) {
      overlayProgress.value = withTiming(0, { duration: 180, easing: Easing.out(Easing.cubic) }, (finished) => {
        if (!finished) return;
        runOnJS(setShouldRender)(false);
      });
      return;
    }

    setShouldRender(true);
    stackProgress.value = withTiming(1, { duration: 280, easing: Easing.out(Easing.cubic) });
    overlayProgress.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
  }, [dismissProgress, overlayProgress, stackProgress, visible]);

  React.useEffect(() => {
    if (visible) return;
    if (shouldRender) return;
    stackProgress.value = 0;
    overlayProgress.value = 0;
    dismissProgress.value = 0;
    setClosingCardId(null);
    setShareCard(null);
    setConfettiShot(null);
    openedInitialShareCardIdRef.current = null;
    firedConfettiCardIdRef.current = null;
    slotAssignmentsRef.current = {};
  }, [dismissProgress, overlayProgress, shouldRender, stackProgress, visible]);

  React.useEffect(() => {
    if (!closingCardId) return;
    const closingCardStillPresent = cards.some((card) => card.id === closingCardId);
    if (closingCardStillPresent) return;
    dismissProgress.value = 0;
    setClosingCardId(null);
  }, [cards, closingCardId, dismissProgress]);

  React.useEffect(() => {
    if (!visible || !initialShareCardId) return;
    if (openedInitialShareCardIdRef.current === initialShareCardId) return;
    const cardToShare = cards.find((card) => card.id === initialShareCardId);
    if (cardToShare && SHAREABLE_CARD_KINDS.has(cardToShare.kind)) {
      openedInitialShareCardIdRef.current = initialShareCardId;
      setShareCard(cardToShare);
    }
  }, [cards, initialShareCardId, visible]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(overlayProgress.value, [0, 1], [0, 1]),
  }));

  const cardWidth = Math.min(width - 40, 336);
  const cardHeight = Math.min(Math.max(Math.round(height * 0.58), 420), 520);
  const horizontalInset = 12;
  const verticalInset = STACK_OFFSET_Y;
  const visibleCards = cards.slice(0, 4);
  const reversedCards = [...visibleCards].reverse();
  const showStackControls = cards.length > 1;
  const topCard = cards[0] ?? null;
  /** Hide as soon as dismiss starts so the FAB does not linger beside the closing animation. */
  const showShareControl =
    !!topCard && SHAREABLE_CARD_KINDS.has(topCard.kind) && closingCardId !== topCard.id;
  React.useEffect(() => {
    if (!visible || !topCard) return;
    if (
      topCard.kind !== 'personalWinner' &&
      topCard.kind !== 'championMiniLeague' &&
      topCard.kind !== 'championOverall'
    ) {
      return;
    }
    if (closingCardId === topCard.id || firedConfettiCardIdRef.current === topCard.id) return;
    firedConfettiCardIdRef.current = topCard.id;
    const champion = topCard.kind === 'championMiniLeague' || topCard.kind === 'championOverall';
    setConfettiShot({
      key: Date.now(),
      cardId: topCard.id,
      monthly: champion ? false : (topCard.eventKey?.includes(':monthly:') ?? false),
      champion,
      championKind: champion
        ? topCard.kind === 'championOverall'
          ? 'championOverall'
          : 'championMiniLeague'
        : undefined,
    });
  }, [closingCardId, topCard, visible]);

  React.useEffect(() => {
    if (!confettiShot) return;
    const maxStagger = (CONFETTI_CANNON_SLOTS - 1) * CONFETTI_AUTO_START_STAGGER_MS;
    const champ = confettiShot.champion === true;
    const hideAfterMs =
      maxStagger +
      (champ ? CHAMPION_CONFETTI_EXPLOSION_MS : PERSONAL_CONFETTI_EXPLOSION_MS) +
      (champ ? CHAMPION_CONFETTI_FALL_MS : PERSONAL_CONFETTI_FALL_MS) +
      CONFETTI_MAX_FALL_VARIANCE_MS +
      3200;
    const id = setTimeout(() => setConfettiShot(null), hideAfterMs);
    return () => clearTimeout(id);
  }, [confettiShot]);

  const openShareTray = React.useCallback(() => {
    if (!topCard) return;
    setShareCard(topCard);
  }, [topCard]);
  const closeShareTray = React.useCallback(() => {
    setShareCard(null);
    if (closeStackOnShareClose) {
      onCloseAll();
    }
  }, [closeStackOnShareClose, onCloseAll]);

  const visibleCardSlots = React.useMemo(() => {
    const nextAssignments: Record<string, number> = {};
    const usedSlots = new Set<number>();

    visibleCards.forEach((card) => {
      const existingSlot = slotAssignmentsRef.current[card.id];
      if (typeof existingSlot === 'number' && existingSlot >= 0 && existingSlot <= 3 && !usedSlots.has(existingSlot)) {
        nextAssignments[card.id] = existingSlot;
        usedSlots.add(existingSlot);
      }
    });

    visibleCards.forEach((card, index) => {
      if (typeof nextAssignments[card.id] === 'number') return;
      const preferredOrder = index === 0 ? [0, 1, 2, 3] : index === 1 ? [1, 2, 3, 0] : index === 2 ? [2, 3, 1, 0] : [3, 2, 1, 0];
      const slot = preferredOrder.find((candidate) => !usedSlots.has(candidate)) ?? 0;
      nextAssignments[card.id] = slot;
      usedSlots.add(slot);
    });

    slotAssignmentsRef.current = nextAssignments;
    return nextAssignments;
  }, [visibleCards]);

  const dismissTop = React.useCallback(() => {
    if (!cards.length || closingCardId) return;
    const topCard = cards[0];
    setClosingCardId(topCard.id);
    dismissProgress.value = 0;
    dismissProgress.value = withTiming(1, { duration: 220, easing: Easing.in(Easing.cubic) }, (finished) => {
      if (!finished) return;
      runOnJS(onDismissTop)();
    });
  }, [cards, closingCardId, dismissProgress, onDismissTop]);

  const dismissTopAfterSwipe = React.useCallback(() => {
    if (!cards.length || closingCardId) return;
    onDismissTop();
  }, [cards.length, closingCardId, onDismissTop]);

  if (!shouldRender) return null;

  return (
    <Modal transparent visible={shouldRender} animationType="none" statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              backgroundColor: 'rgba(2,6,23,0.7)',
            },
            overlayStyle,
          ]}
        />

        {visible ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Dismiss popup" onPress={dismissTop} style={{ flex: 1 }} />
        ) : null}

        {visible && cards.length ? (
          <View
            pointerEvents="box-none"
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 20,
              paddingTop: insets.top + 16,
              paddingBottom: insets.bottom + 20,
            }}
          >
            <View style={{ minHeight: STACK_META_HEIGHT, marginBottom: 14, justifyContent: 'center' }}>
              <TotlText
                style={{
                  color: '#FFFFFF',
                  fontFamily: 'Gramatika-Medium',
                  fontWeight: '700',
                  fontSize: 14,
                  lineHeight: 18,
                  textAlign: 'center',
                  opacity: showStackControls ? 1 : 0,
                }}
              >
                {`1 of ${cards.length}`}
              </TotlText>
            </View>

            <View style={{ width: cardWidth + 24, height: cardHeight + STACK_OFFSET_Y * 2 }}>
              {reversedCards.map((card) => {
                const isTopCard = card.id === cards[0]?.id;
                const isClosing = card.id === closingCardId;
                const slot = visibleCardSlots[card.id] ?? 0;
                const slotStyle = getStackSlotStyle(slot);
                return (
                  <StackCard
                    key={card.id}
                    card={card}
                    cardWidth={cardWidth}
                    cardHeight={cardHeight}
                    horizontalInset={horizontalInset}
                    verticalInset={verticalInset}
                    baseTranslateX={slotStyle.translateX}
                    baseTranslateY={slotStyle.translateY}
                    baseRotationDeg={slotStyle.rotationDeg}
                    isTopCard={isTopCard}
                    isClosing={isClosing}
                    stackProgress={stackProgress}
                    dismissProgress={dismissProgress}
                    onClose={dismissTop}
                    onSwipeDismiss={dismissTopAfterSwipe}
                  />
                );
              })}
            </View>

            <View
              style={{
                minHeight: STACK_ACTION_HEIGHT,
                justifyContent: 'flex-end',
                alignItems: 'center',
                flexDirection: 'row',
              }}
            >
              {showShareControl ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Share popup card"
                  onPress={openShareTray}
                  style={({ pressed }) => ({
                    width: 46,
                    height: 46,
                    borderRadius: 23,
                    marginRight: showStackControls ? 10 : 0,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'rgba(255,255,255,0.16)',
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.24)',
                    opacity: pressed ? 0.75 : 1,
                  })}
                >
                  <Ionicons name="share-social-outline" size={22} color="#FFFFFF" />
                </Pressable>
              ) : null}

              {showStackControls ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close all popups"
                  onPress={onCloseAll}
                  style={({ pressed }) => ({
                    alignSelf: 'center',
                    paddingHorizontal: 18,
                    paddingVertical: 10,
                    borderRadius: 999,
                    backgroundColor: 'rgba(255,255,255,0.12)',
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.18)',
                    opacity: pressed ? 0.75 : 1,
                  })}
                >
                  <TotlText
                    style={{
                      color: '#FFFFFF',
                      fontFamily: 'Gramatika-Medium',
                      fontWeight: '700',
                      fontSize: 14,
                      lineHeight: 18,
                    }}
                  >
                    Close all
                  </TotlText>
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : null}

        {shareCard ? <PopupCardShareTray card={shareCard} cardWidth={cardWidth} cardHeight={cardHeight} onClose={closeShareTray} /> : null}
        {confettiShot ? (
          <View
            pointerEvents="none"
            style={[StyleSheet.absoluteFillObject, { zIndex: 1000, elevation: 1000, overflow: 'hidden' }]}
          >
            {(() => {
              const totalParticles = confettiShot.champion
                ? CHAMPION_CONFETTI_COUNT
                : confettiShot.monthly
                  ? PERSONAL_WINNER_MONTHLY_CONFETTI_COUNT
                  : PERSONAL_WINNER_GW_CONFETTI_COUNT;
              const perSlot = splitConfettiCount(totalParticles, CONFETTI_CANNON_SLOTS);
              const champ = confettiShot.champion === true;
              const colors = champ
                ? confettiShot.championKind === 'championOverall'
                  ? CHAMPION_OVERALL_CONFETTI_COLORS
                  : CHAMPION_MINI_LEAGUE_CONFETTI_COLORS
                : undefined;
              return perSlot.map((slotCount, slot) =>
                slotCount > 0 ? (
                  <ConfettiCannon
                    key={`${confettiShot.key}-s${slot}`}
                    count={slotCount}
                    origin={confettiOriginForSlot(slot, width)}
                    explosionSpeed={confettiExplosionMs(slot, champ)}
                    fallSpeed={confettiFallMs(slot, champ)}
                    fadeOut
                    colors={colors}
                    autoStartDelay={slot * CONFETTI_AUTO_START_STAGGER_MS}
                  />
                ) : null
              );
            })()}
          </View>
        ) : null}
      </View>
    </Modal>
  );
}
