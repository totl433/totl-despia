import React from 'react';
import { View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  type SharedValue,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import RetroDailyLogoBack from './RetroDailyLogoBack';

const SWIPE_THRESHOLD = 100;
const DRAW_THRESHOLD = 120;
const RESET_SPRING = { damping: 18, stiffness: 220 };

type Props = {
  cardKey: string;
  children: React.ReactNode;
  showNext?: boolean;
  showQueued?: boolean;
  /** Under-card peek face (defaults to logo back). */
  nextFace?: React.ReactNode;
  /** Third-card peek face (defaults to logo back). */
  queuedFace?: React.ReactNode;
  disabled?: boolean;
  /** Shared with parent so pick buttons can highlight while dragging. */
  dragX: SharedValue<number>;
  dragY: SharedValue<number>;
  /** Called at swipe commit — parent should advance to the next face immediately. */
  onSwipeAway: (dx: number, dy: number) => void;
};

/**
 * Predictions-style stack: peeks under, outgoing flies on z4, new top is already planted.
 */
export default function RetroDailySwipeStack({
  cardKey,
  children,
  showNext = true,
  showQueued = true,
  nextFace,
  queuedFace,
  disabled = false,
  dragX,
  dragY,
  onSwipeAway,
}: Props) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const cardWidth = Math.min(420, screenWidth - 32);
  const cardHeight = cardWidth / 0.75;

  const [outgoing, setOutgoing] = React.useState<React.ReactNode | null>(null);
  const [settling, setSettling] = React.useState(false);
  const childrenRef = React.useRef(children);
  childrenRef.current = children;

  const tx = dragX;
  const ty = dragY;
  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);
  const revealProgress = useSharedValue(0);
  const isAnimating = useSharedValue(0);

  const resetMotion = React.useCallback(() => {
    tx.value = 0;
    ty.value = 0;
    opacity.value = 1;
    scale.value = 1;
    revealProgress.value = 0;
    isAnimating.value = 0;
  }, [isAnimating, opacity, revealProgress, scale, tx, ty]);

  const finishTransition = React.useCallback(() => {
    setOutgoing(null);
    setSettling(true);
    requestAnimationFrame(() => {
      resetMotion();
      setSettling(false);
    });
  }, [resetMotion]);

  const startFlyOff = React.useCallback(
    (dx: number, dy: number) => {
      if (disabled || outgoing || settling || isAnimating.value === 1) return;
      isAnimating.value = 1;

      // Snapshot the leaving face, then ask parent to plant the next face underneath.
      const leaving = childrenRef.current;
      setOutgoing(leaving);
      onSwipeAway(dx, dy);

      const startX = tx.value;
      const startY = ty.value;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);
      let offX = 0;
      let offY = 0;
      if (absX >= absY && absX > 8) {
        offX = dx >= 0 ? screenWidth * 1.12 : -screenWidth * 1.12;
      } else if (absY > 8) {
        offY = dy >= 0 ? screenHeight * 1.02 : -screenHeight * 1.02;
      } else {
        offY = screenHeight * 0.55;
      }
      const easing = Easing.bezier(0.2, 0.8, 0.2, 1);
      tx.value = withTiming(startX + offX, { duration: 240, easing });
      ty.value = withTiming(startY + offY, { duration: 240, easing });
      opacity.value = withTiming(0, { duration: 220, easing });
      revealProgress.value = withTiming(1, { duration: 240, easing });
      scale.value = withTiming(0.96, { duration: 240, easing }, (finished) => {
        if (!finished) return;
        runOnJS(finishTransition)();
      });
    },
    [
      disabled,
      finishTransition,
      isAnimating,
      onSwipeAway,
      opacity,
      outgoing,
      revealProgress,
      scale,
      screenHeight,
      screenWidth,
      settling,
      tx,
      ty,
    ]
  );

  const gesture = React.useMemo(() => {
    return Gesture.Pan()
      .enabled(!disabled && !outgoing && !settling)
      .maxPointers(1)
      .onUpdate((e) => {
        if (disabled || outgoing || settling || isAnimating.value === 1) return;
        tx.value = e.translationX;
        ty.value = e.translationY;
        const absX = Math.abs(e.translationX);
        const absY = Math.abs(e.translationY);
        revealProgress.value = Math.min(1, Math.max(absX, absY) / SWIPE_THRESHOLD);
      })
      .onEnd((e) => {
        if (disabled || outgoing || settling || isAnimating.value === 1) return;
        const dx = e.translationX ?? 0;
        const dy = e.translationY ?? 0;
        if (Math.abs(dx) > 60 || Math.abs(dy) > 60) {
          runOnJS(startFlyOff)(dx, dy);
          return;
        }
        tx.value = withSpring(0, RESET_SPRING);
        ty.value = withSpring(0, RESET_SPRING);
        revealProgress.value = withSpring(0, RESET_SPRING);
      });
  }, [disabled, isAnimating, outgoing, revealProgress, settling, startFlyOff, tx, ty]);

  const topCardStyle = useAnimatedStyle(() => {
    const rotate = `${(tx.value / Math.max(1, screenWidth)) * 14}deg`;
    return {
      opacity: opacity.value,
      transform: [{ translateX: tx.value }, { translateY: ty.value }, { rotateZ: rotate }, { scale: scale.value }],
    };
  });

  const promotedCardStyle = useAnimatedStyle(() => {
    const progress = revealProgress.value;
    return {
      opacity: 0.84 + 0.16 * progress,
      transform: [{ translateY: 10 - 10 * progress }, { scale: 0.968 + 0.032 * progress }],
    };
  });

  const queuedCardStyle = useAnimatedStyle(() => ({
    opacity: 0.72,
    transform: [{ translateY: 20 }, { scale: 0.935 }],
  }));

  const busy = !!outgoing || settling;

  return (
    <GestureDetector gesture={gesture}>
      <View style={{ width: cardWidth, height: cardHeight }}>
        {showQueued ? (
          <Animated.View
            pointerEvents="none"
            style={[{ position: 'absolute', inset: 0, zIndex: 1 }, queuedCardStyle]}
          >
            {queuedFace ?? <RetroDailyLogoBack />}
          </Animated.View>
        ) : null}

        {showNext ? (
          <Animated.View
            pointerEvents="none"
            style={[{ position: 'absolute', inset: 0, zIndex: 2 }, promotedCardStyle]}
          >
            {nextFace ?? <RetroDailyLogoBack />}
          </Animated.View>
        ) : null}

        {busy ? (
          <View key={`planted-${cardKey}`} style={{ position: 'absolute', inset: 0, zIndex: 3 }}>
            {children}
          </View>
        ) : (
          <Animated.View
            key={`live-${cardKey}`}
            style={[{ position: 'absolute', inset: 0, zIndex: 3 }, topCardStyle]}
          >
            {children}
          </Animated.View>
        )}

        {outgoing ? (
          <Animated.View
            pointerEvents="none"
            style={[{ position: 'absolute', inset: 0, zIndex: 4 }, topCardStyle]}
          >
            {outgoing}
          </Animated.View>
        ) : null}
      </View>
    </GestureDetector>
  );
}

export { SWIPE_THRESHOLD, DRAW_THRESHOLD };
