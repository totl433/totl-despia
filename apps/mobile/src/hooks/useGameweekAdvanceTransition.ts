import * as React from 'react';
import { AccessibilityInfo } from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  Easing,
  runOnJS,
  runOnUI,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

type StartArgs = {
  nextGameweekLabel: string;
  onAdvance: () => void | Promise<void>;
};

export type GameweekAdvanceTransitionController = {
  start: (args: StartArgs) => void;
  isAnimating: boolean;
  label: string | null;

  /** True when OS “Reduce Motion” is enabled. */
  reducedMotion: boolean;

  /** Set by the wrapper component so wipe distances are correct. */
  viewportHeight: ReturnType<typeof useSharedValue<number>>;

  /** Shared values consumed by the wrapper component. */
  contentScale: ReturnType<typeof useSharedValue<number>>;
  contentOpacity: ReturnType<typeof useSharedValue<number>>;
  overlayTranslateY: ReturnType<typeof useSharedValue<number>>;
  overlayOpacity: ReturnType<typeof useSharedValue<number>>;
  textOpacity: ReturnType<typeof useSharedValue<number>>;
  textScale: ReturnType<typeof useSharedValue<number>>;
};

export function useGameweekAdvanceTransition(opts?: { totalMs?: number }): GameweekAdvanceTransitionController {
  const totalMs = opts?.totalMs ?? 1050;
  const enterMs = Math.round(totalMs * 0.45);
  const exitMs = Math.round(totalMs * 0.45);

  const [isAnimating, setIsAnimating] = React.useState(false);
  const [label, setLabel] = React.useState<string | null>(null);
  const [reducedMotion, setReducedMotion] = React.useState(false);

  const animatingRef = React.useRef(false);
  const onAdvanceRef = React.useRef<StartArgs['onAdvance'] | null>(null);

  const viewportHeight = useSharedValue(0);

  const contentScale = useSharedValue(1);
  const contentOpacity = useSharedValue(1);

  const overlayTranslateY = useSharedValue(0);
  const overlayOpacity = useSharedValue(0);

  const textOpacity = useSharedValue(0);
  const textScale = useSharedValue(0.98);

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const enabled = await AccessibilityInfo.isReduceMotionEnabled();
        if (!cancelled) setReducedMotion(Boolean(enabled));
      } catch {
        // ignore
      }
    })();

    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (v: boolean) => {
      setReducedMotion(Boolean(v));
    });

    return () => {
      cancelled = true;
      // RN event subscription compat across versions
      try {
        (sub as any)?.remove?.();
      } catch {
        // ignore
      }
    };
  }, []);

  const start = React.useCallback(
    ({ nextGameweekLabel, onAdvance }: StartArgs) => {
      // Guard against double taps (state updates aren't synchronous).
      if (animatingRef.current || isAnimating) return;
      animatingRef.current = true;

      onAdvanceRef.current = onAdvance;
      setIsAnimating(true);
      setLabel(nextGameweekLabel);

      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {
        // ignore
      });

      const h = viewportHeight.value || 1000;

      // Base reset (next frame will render overlay)
      overlayOpacity.value = 1;
      overlayTranslateY.value = h;
      textOpacity.value = 0;
      textScale.value = 0.98;

      const ease = Easing.bezier(0.2, 0.0, 0.0, 1.0);

      const finish = () => {
        animatingRef.current = false;
        setIsAnimating(false);
        setLabel(null);
      };

      const invokeAdvance = async () => {
        try {
          await onAdvanceRef.current?.();
        } catch (err) {
          console.error('[useGameweekAdvanceTransition] onAdvance failed:', err);
        } finally {
          runOnUI(() => {
            'worklet';

            // Exit wipe (up + out)
            overlayTranslateY.value = withTiming(
              -h,
              { duration: exitMs, easing: ease },
              (finished) => {
                if (!finished) return;
                overlayOpacity.value = 0;
                overlayTranslateY.value = h;
                textOpacity.value = 0;
                textScale.value = 0.98;
                runOnJS(finish)();
              }
            );

            // Restore content underlay while overlay exits
            contentScale.value = withTiming(1, { duration: Math.round(exitMs * 0.7), easing: ease });
            contentOpacity.value = withTiming(1, { duration: Math.round(exitMs * 0.7), easing: ease });
          })();
        }
      };

      if (reducedMotion) {
        contentScale.value = withTiming(0.96, { duration: 140, easing: ease });
        contentOpacity.value = withTiming(0.7, { duration: 140, easing: ease });
        overlayTranslateY.value = withTiming(0, { duration: 140, easing: ease }, () => {
          runOnJS(invokeAdvance)();
        });
        textOpacity.value = withTiming(1, { duration: 120, easing: ease });
        textScale.value = withTiming(1, { duration: 120, easing: ease });
        return;
      }

      // Content recede
      contentScale.value = withTiming(0.96, { duration: enterMs, easing: ease });
      contentOpacity.value = withTiming(0.7, { duration: enterMs, easing: ease });

      // Overlay wipe in; when fully covered, call onAdvance on JS thread.
      overlayTranslateY.value = withTiming(0, { duration: enterMs, easing: ease }, (finished) => {
        if (!finished) return;
        runOnJS(invokeAdvance)();
      });

      // Headline reveal slightly after wipe starts
      textOpacity.value = withDelay(120, withTiming(1, { duration: 240, easing: ease }));
      textScale.value = withDelay(120, withTiming(1, { duration: 280, easing: ease }));
    },
    [
      animatingRef,
      contentOpacity,
      contentScale,
      enterMs,
      exitMs,
      isAnimating,
      overlayOpacity,
      overlayTranslateY,
      reducedMotion,
      textOpacity,
      textScale,
      viewportHeight,
    ]
  );

  return {
    start,
    isAnimating,
    label,
    reducedMotion,
    viewportHeight,
    contentScale,
    contentOpacity,
    overlayTranslateY,
    overlayOpacity,
    textOpacity,
    textScale,
  };
}

