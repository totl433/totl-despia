import React from 'react';
import { Modal, Pressable, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { TotlText } from '@totl/ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import PopupInfoCard from './PopupInfoCard';
import type { PopupCardDescriptor } from './types';

const STACK_OFFSET_Y = 14;
const STACK_META_HEIGHT = 32;
const STACK_ACTION_HEIGHT = 64;

function getStackSlotStyle(slot: number): { translateX: number; translateY: number; rotationDeg: number } {
  switch (slot) {
    case 1:
      return { translateX: 6, translateY: 10, rotationDeg: -0.9 };
    case 2:
      return { translateX: -5, translateY: 18, rotationDeg: 0.7 };
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
    const enterTranslateX = interpolate(stackProgress.value, [0, 1], [cardWidth + 48, baseTranslateX]);
    const closingTranslateX = interpolate(dismissProgress.value, [0, 1], [baseTranslateX, -cardWidth - 72]);
    const dragAdjustedTranslateX = enterTranslateX + (isTopCard ? dragTranslateX.value : 0);
    const translateX = isClosing ? closingTranslateX : dragAdjustedTranslateX;
    const translateY = baseTranslateY + (isTopCard ? dragTranslateY.value : 0);
    const rotateDeg = baseRotationDeg + (isTopCard ? dragRotationDeg.value : 0);
    const opacity = isClosing ? interpolate(dismissProgress.value, [0, 1], [1, 0.7]) : isTopCard ? dragOpacity.value : 1;

    return {
      opacity,
      transform: [{ translateX }, { translateY }, { rotateZ: `${rotateDeg}deg` }],
    };
  }, [
    baseRotationDeg,
    baseTranslateX,
    baseTranslateY,
    cardWidth,
    dismissProgress,
    dragOpacity,
    dragRotationDeg,
    dragTranslateX,
    dragTranslateY,
    isClosing,
    isTopCard,
    stackProgress,
  ]);

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
          title={card.title}
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
  onDismissTop,
  onCloseAll,
}: {
  cards: PopupCardDescriptor[];
  visible: boolean;
  onDismissTop: () => void;
  onCloseAll: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [closingCardId, setClosingCardId] = React.useState<string | null>(null);
  const [shouldRender, setShouldRender] = React.useState(visible);
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
    slotAssignmentsRef.current = {};
  }, [dismissProgress, overlayProgress, shouldRender, stackProgress, visible]);

  React.useEffect(() => {
    if (!closingCardId) return;
    const closingCardStillPresent = cards.some((card) => card.id === closingCardId);
    if (closingCardStillPresent) return;
    dismissProgress.value = 0;
    setClosingCardId(null);
  }, [cards, closingCardId, dismissProgress]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(overlayProgress.value, [0, 1], [0, 1]),
  }));

  const cardWidth = Math.min(width - 40, 336);
  const cardHeight = Math.min(Math.max(Math.round(height * 0.58), 420), 520);
  const horizontalInset = 12;
  const verticalInset = STACK_OFFSET_Y;
  const visibleCards = cards.slice(0, 3);
  const reversedCards = [...visibleCards].reverse();
  const showStackControls = cards.length > 1;

  const visibleCardSlots = React.useMemo(() => {
    const nextAssignments: Record<string, number> = {};
    const usedSlots = new Set<number>();

    visibleCards.forEach((card) => {
      const existingSlot = slotAssignmentsRef.current[card.id];
      if (typeof existingSlot === 'number' && existingSlot >= 0 && existingSlot <= 2 && !usedSlots.has(existingSlot)) {
        nextAssignments[card.id] = existingSlot;
        usedSlots.add(existingSlot);
      }
    });

    visibleCards.forEach((card, index) => {
      if (typeof nextAssignments[card.id] === 'number') return;
      const preferredOrder = index === 0 ? [0, 1, 2] : index === 1 ? [1, 2, 0] : [2, 1, 0];
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

            <View style={{ minHeight: STACK_ACTION_HEIGHT, justifyContent: 'flex-end' }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close all popups"
                disabled={!showStackControls}
                onPress={onCloseAll}
                style={({ pressed }) => ({
                  alignSelf: 'center',
                  marginTop: 22,
                  paddingHorizontal: 18,
                  paddingVertical: 10,
                  borderRadius: 999,
                  backgroundColor: 'rgba(255,255,255,0.12)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.18)',
                  opacity: showStackControls ? (pressed ? 0.75 : 1) : 0,
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
            </View>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}
