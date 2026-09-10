import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  type SharedValue,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import RetroDailyLogoBack from './RetroDailyLogoBack';

export const SWIPE_THRESHOLD = 100;
export const DRAW_THRESHOLD = 120;

const USER_FLY_MS = 280;
const AUTO_FLY_MS = 420;
const RESET_SPRING = { damping: 18, stiffness: 220 };
const FLY_EASING = Easing.bezier(0.2, 0.85, 0.25, 1);
const FILL = StyleSheet.absoluteFillObject;

type Props = {
  cardKey: string;
  children: React.ReactNode;
  showNext?: boolean;
  showQueued?: boolean;
  nextFace?: React.ReactNode;
  queuedFace?: React.ReactNode;
  seasonLabel?: string;
  disabled?: boolean;
  tapAdvances?: boolean;
  flyAwayNonce?: number;
  dragX: SharedValue<number>;
  dragY: SharedValue<number>;
  onSwipeAway: (dx: number, dy: number) => void;
};

/**
 * Predictions-style stack: peek underneath, freeze the outgoing face, plant the
 * next face, then fly. One Reanimated driver — no RN Animated mix.
 */
export default function RetroDailySwipeStack({
  cardKey,
  children,
  showNext = true,
  showQueued = true,
  nextFace,
  queuedFace,
  seasonLabel,
  disabled = false,
  tapAdvances = false,
  flyAwayNonce = 0,
  dragX,
  dragY,
  onSwipeAway,
}: Props) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const cardWidth = Math.min(420, screenWidth - 32);
  const cardHeight = cardWidth / 0.75;

  const childrenRef = React.useRef(children);
  childrenRef.current = children;
  const onSwipeAwayRef = React.useRef(onSwipeAway);
  onSwipeAwayRef.current = onSwipeAway;
  const disabledRef = React.useRef(disabled);
  disabledRef.current = disabled;

  const [outgoing, setOutgoing] = React.useState<React.ReactNode | null>(null);
  const [settling, setSettling] = React.useState(false);
  const flyingRef = React.useRef(false);
  const lastFlyNonce = React.useRef(0);
  const flyTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);
  const reveal = useSharedValue(0);

  const busy = outgoing != null || settling;

  const resetMotion = React.useCallback(() => {
    tx.value = 0;
    ty.value = 0;
    opacity.value = 1;
    scale.value = 1;
    reveal.value = 0;
    dragX.value = 0;
    dragY.value = 0;
  }, [dragX, dragY, opacity, reveal, scale, tx, ty]);

  const finishFly = React.useCallback(() => {
    if (flyTimer.current) {
      clearTimeout(flyTimer.current);
      flyTimer.current = null;
    }
    flyingRef.current = false;
    setOutgoing(null);
    setSettling(true);
    requestAnimationFrame(() => {
      resetMotion();
      setSettling(false);
    });
  }, [resetMotion]);

  const startFlyOff = React.useCallback(
    (dx: number, dy: number, opts?: { force?: boolean }) => {
      if (flyingRef.current) return;
      if (!opts?.force && (disabledRef.current || settling)) return;

      flyingRef.current = true;
      if (flyTimer.current) clearTimeout(flyTimer.current);

      const leaving = freezeOutgoingFace(childrenRef.current);
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);
      const duration = opts?.force ? AUTO_FLY_MS : USER_FLY_MS;

      let offX = 0;
      let offY = 0;
      if (opts?.force) {
        offX = -screenWidth * 1.25;
        offY = -screenHeight * 0.12;
      } else if (absX >= absY && absX > 8) {
        offX = dx >= 0 ? screenWidth * 1.12 : -screenWidth * 1.12;
        offY = dy * 0.35;
      } else if (absY > 8) {
        offY = dy >= 0 ? screenHeight * 1.02 : -screenHeight * 1.02;
        offX = dx * 0.35;
      } else {
        offY = screenHeight * 0.55;
      }

      setOutgoing(leaving);
      onSwipeAwayRef.current(opts?.force ? -140 : dx, opts?.force ? -80 : dy);
      dragX.value = 0;
      dragY.value = 0;

      const fly = { duration, easing: FLY_EASING };
      // Paint the planted card first, then wind-up + fly (avoids a 1-frame jump).
      requestAnimationFrame(() => {
        tx.value = opts?.force ? -52 : dx;
        ty.value = opts?.force ? -28 : dy;
        opacity.value = 1;
        scale.value = 1;
        reveal.value = opts?.force ? 0.55 : Math.min(1, Math.max(absX, absY) / SWIPE_THRESHOLD);
        requestAnimationFrame(() => {
          tx.value = withTiming(offX, fly);
          ty.value = withTiming(offY, fly);
          reveal.value = withTiming(1, fly);
          opacity.value = withTiming(0, { duration: Math.round(duration * 0.85), easing: FLY_EASING });
          scale.value = withTiming(0.94, fly);
        });
      });

      flyTimer.current = setTimeout(finishFly, duration + 80);
    },
    [dragX, dragY, finishFly, opacity, reveal, scale, screenHeight, screenWidth, settling, tx, ty]
  );

  React.useEffect(() => {
    if (!flyAwayNonce || flyAwayNonce === lastFlyNonce.current) return;
    lastFlyNonce.current = flyAwayNonce;
    startFlyOff(-140, -80, { force: true });
  }, [flyAwayNonce, startFlyOff]);

  React.useEffect(() => {
    if (flyingRef.current || outgoing || settling) return;
    resetMotion();
  }, [cardKey, outgoing, resetMotion, settling]);

  React.useEffect(
    () => () => {
      if (flyTimer.current) clearTimeout(flyTimer.current);
    },
    []
  );

  const gesture = React.useMemo(() => {
    const pan = Gesture.Pan()
      .enabled(!disabled && !busy)
      .maxPointers(1)
      .onUpdate((e) => {
        if (disabled || flyingRef.current) return;
        tx.value = e.translationX;
        ty.value = e.translationY;
        dragX.value = e.translationX;
        dragY.value = e.translationY;
        const absX = Math.abs(e.translationX);
        const absY = Math.abs(e.translationY);
        reveal.value = Math.min(1, Math.max(absX, absY) / SWIPE_THRESHOLD);
      })
      .onEnd((e) => {
        if (disabled || flyingRef.current) return;
        const dx = e.translationX ?? 0;
        const dy = e.translationY ?? 0;
        if (Math.abs(dx) > 60 || Math.abs(dy) > 60) {
          runOnJS(startFlyOff)(dx, dy);
          return;
        }
        tx.value = withSpring(0, RESET_SPRING);
        ty.value = withSpring(0, RESET_SPRING);
        dragX.value = withSpring(0, RESET_SPRING);
        dragY.value = withSpring(0, RESET_SPRING);
        reveal.value = withSpring(0, RESET_SPRING);
      });

    if (!tapAdvances) return pan;

    const tap = Gesture.Tap()
      .enabled(!disabled && !busy)
      .maxDuration(280)
      .onEnd(() => {
        runOnJS(startFlyOff)(0, 160);
      });

    return Gesture.Exclusive(tap, pan);
  }, [busy, disabled, dragX, dragY, reveal, startFlyOff, tapAdvances, tx, ty]);

  const flyStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { rotateZ: `${(tx.value / Math.max(1, screenWidth)) * 14}deg` },
      { scale: scale.value },
    ],
  }));

  const promotedCardStyle = useAnimatedStyle(() => {
    const progress = reveal.value;
    return {
      opacity: 0.84 + 0.16 * progress,
      transform: [{ translateY: 10 - 10 * progress }, { scale: 0.968 + 0.032 * progress }],
    };
  });

  const queuedCardStyle = useAnimatedStyle(() => ({
    opacity: 0.72,
    transform: [{ translateY: 20 }, { scale: 0.935 }],
  }));

  const defaultBack = <RetroDailyLogoBack seasonLabel={seasonLabel} />;

  return (
    <GestureDetector gesture={gesture}>
      <View style={{ width: cardWidth, height: cardHeight }}>
        {showQueued ? (
          <Animated.View pointerEvents="none" style={[FILL, { zIndex: 1 }, queuedCardStyle]}>
            {(queuedFace ?? defaultBack) as React.ReactElement}
          </Animated.View>
        ) : null}

        {showNext ? (
          <Animated.View pointerEvents="none" style={[FILL, { zIndex: 2 }, promotedCardStyle]}>
            {(nextFace ?? defaultBack) as React.ReactElement}
          </Animated.View>
        ) : null}

        {busy ? (
          <View style={[FILL, { zIndex: 3 }]}>{children}</View>
        ) : (
          <Animated.View style={[FILL, { zIndex: 3 }, flyStyle]}>{children as React.ReactElement}</Animated.View>
        )}

        {outgoing ? (
          <Animated.View pointerEvents="none" collapsable={false} style={[FILL, { zIndex: 4 }, flyStyle]}>
            {outgoing as React.ReactElement}
          </Animated.View>
        ) : null}
      </View>
    </GestureDetector>
  );
}

function freezeOutgoingFace(node: React.ReactNode): React.ReactNode {
  if (!React.isValidElement(node)) return node;
  return React.cloneElement(node as React.ReactElement<{ instant?: boolean }>, { instant: true });
}
