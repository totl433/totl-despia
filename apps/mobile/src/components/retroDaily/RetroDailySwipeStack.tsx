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
  /** Override the default card size (The Players uses the design's 353 × 459 card). */
  cardSize?: { width: number; height: number };
  /**
   * Never remount a card mid-swipe. The top card's own view becomes the outgoing
   * card (no frozen copy), and the new top card mounts once. By default a fresh
   * copy flies off and the new face mounts twice, so images can flash as they reload.
   */
  keepChildrenMounted?: boolean;
  /**
   * A tap sends the card off with the same eased wind-up and exit as `flyAwayNonce`
   * (an answer pick), rather than dropping it straight down.
   */
  smoothTap?: boolean;
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
  cardSize,
  keepChildrenMounted = false,
  smoothTap = false,
}: Props) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const cardWidth = cardSize?.width ?? Math.min(420, screenWidth - 32);
  const cardHeight = cardSize?.height ?? cardWidth / 0.75;

  const childrenRef = React.useRef(children);
  childrenRef.current = children;
  const onSwipeAwayRef = React.useRef(onSwipeAway);
  onSwipeAwayRef.current = onSwipeAway;
  const disabledRef = React.useRef(disabled);
  disabledRef.current = disabled;

  const [outgoing, setOutgoing] = React.useState<React.ReactNode | null>(null);
  const [settling, setSettling] = React.useState(false);
  /** keepChildrenMounted: bumps on each fly, so the old top card's view carries on as the outgoing card. */
  const [layer, setLayer] = React.useState(0);
  const [outgoingLayer, setOutgoingLayer] = React.useState(0);
  const layerRef = React.useRef(0);
  const flyingRef = React.useRef(false);
  const lastFlyNonce = React.useRef(0);
  const flyTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);
  const reveal = useSharedValue(0);
  /** keepChildrenMounted: 1 holds the new top card still while the outgoing card flies. */
  const held = useSharedValue(0);

  const busy = outgoing != null || settling;

  const resetMotion = React.useCallback(() => {
    tx.value = 0;
    ty.value = 0;
    opacity.value = 1;
    scale.value = 1;
    reveal.value = 0;
    held.value = 0;
    dragX.value = 0;
    dragY.value = 0;
  }, [dragX, dragY, held, opacity, reveal, scale, tx, ty]);

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
      if (keepChildrenMounted) {
        setOutgoingLayer(layerRef.current);
        layerRef.current += 1;
        setLayer(layerRef.current);
      }
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
          // Backstop for the layout effect: by now the outgoing copy is on screen.
          if (keepChildrenMounted) held.value = 1;
          tx.value = withTiming(offX, fly);
          ty.value = withTiming(offY, fly);
          reveal.value = withTiming(1, fly);
          opacity.value = withTiming(0, { duration: Math.round(duration * 0.85), easing: FLY_EASING });
          scale.value = withTiming(0.94, fly);
        });
      });

      flyTimer.current = setTimeout(finishFly, duration + 80);
    },
    [dragX, dragY, finishFly, held, keepChildrenMounted, opacity, reveal, scale, screenHeight, screenWidth, settling, tx, ty]
  );

  const tapFlyOff = React.useCallback(() => {
    if (!smoothTap) {
      startFlyOff(0, 160);
      return;
    }
    // Same guards as a swipe, then the answer-pick motion.
    if (disabledRef.current || settling) return;
    startFlyOff(-140, -80, { force: true });
  }, [settling, smoothTap, startFlyOff]);

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
        // No flyingRef here: a ref read in a worklet is frozen in dev, which breaks the JS-side guard.
        if (disabled) return;
        tx.value = e.translationX;
        ty.value = e.translationY;
        dragX.value = e.translationX;
        dragY.value = e.translationY;
        const absX = Math.abs(e.translationX);
        const absY = Math.abs(e.translationY);
        reveal.value = Math.min(1, Math.max(absX, absY) / SWIPE_THRESHOLD);
      })
      .onEnd((e) => {
        if (disabled) return;
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
        runOnJS(tapFlyOff)();
      });

    return Gesture.Exclusive(tap, pan);
  }, [busy, disabled, dragX, dragY, reveal, startFlyOff, tapAdvances, tapFlyOff, tx, ty]);

  const flyStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { rotateZ: `${(tx.value / Math.max(1, screenWidth)) * 14}deg` },
      { scale: scale.value },
    ],
  }));

  // The new top card sits under the outgoing card (same position) until held, then stays put.
  const topCardStyle = useAnimatedStyle(() => {
    if (held.value) return { opacity: 1, transform: [{ translateX: 0 }, { translateY: 0 }, { rotateZ: '0deg' }, { scale: 1 }] };
    return {
      opacity: opacity.value,
      transform: [
        { translateX: tx.value },
        { translateY: ty.value },
        { rotateZ: `${(tx.value / Math.max(1, screenWidth)) * 14}deg` },
        { scale: scale.value },
      ],
    };
  });

  // Hold the new top card once the outgoing copy is on screen above it, before the fly starts.
  React.useLayoutEffect(() => {
    if (keepChildrenMounted && outgoing) held.value = 1;
  }, [held, keepChildrenMounted, outgoing]);

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

        {keepChildrenMounted ? (
          <>
            <Animated.View key={`card-${layer}`} style={[FILL, { zIndex: 3 }, topCardStyle]}>
              {children as React.ReactElement}
            </Animated.View>
            {outgoing ? (
              <Animated.View
                key={`card-${outgoingLayer}`}
                pointerEvents="none"
                collapsable={false}
                style={[FILL, { zIndex: 4 }, flyStyle]}
              >
                {outgoing as React.ReactElement}
              </Animated.View>
            ) : null}
          </>
        ) : busy ? (
          <View style={[FILL, { zIndex: 3 }]}>{children}</View>
        ) : (
          <Animated.View style={[FILL, { zIndex: 3 }, flyStyle]}>{children as React.ReactElement}</Animated.View>
        )}

        {outgoing && !keepChildrenMounted ? (
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
