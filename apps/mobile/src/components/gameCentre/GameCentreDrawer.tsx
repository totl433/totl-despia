import React from "react";
import {
  AccessibilityInfo,
  BackHandler,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useTokens } from "@totl/ui";

type GameCentreMenuControls = {
  toggle: () => void;
  close: (after?: () => void) => void;
};

// The controls never change, so the Game Centre feed doesn't redraw when the menu opens.
// Whether it's open lives in its own context, read only by the menu button.
const GameCentreMenuContext =
  React.createContext<GameCentreMenuControls | null>(null);
const GameCentreMenuOpenContext = React.createContext(false);

/** The side menu's controls, or null outside the Game Centre home. */
export function useGameCentreMenu(): GameCentreMenuControls | null {
  return React.useContext(GameCentreMenuContext);
}

/** The ☰ button in the Game Centre header. */
export function GameCentreMenuButton() {
  const t = useTokens();
  const controls = React.useContext(GameCentreMenuContext);
  const open = React.useContext(GameCentreMenuOpenContext);
  if (!controls) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={open ? "Close menu" : "Open menu"}
      accessibilityState={{ expanded: open }}
      onPress={controls.toggle}
      hitSlop={8}
      style={({ pressed }) => ({ padding: 4, opacity: pressed ? 0.6 : 1 })}
    >
      <Ionicons name="menu-outline" size={30} color={t.color.text} />
    </Pressable>
  );
}

const OPEN_MS = 280;
/** How much of the Game Centre stays in view when the menu is open (Figma 272:33416). */
const PEEK = 71;
/** Left-edge strip that starts a swipe-to-open, without stealing feed scrolls. */
const OPEN_EDGE = 28;

/**
 * Side menu that pushes the Game Centre to the right rather than covering it.
 * Open from the ☰ button or a swipe in from the left edge. Close by tapping the
 * menu button again, tapping the Game Centre, or swiping it left.
 */
export default function GameCentreDrawer({
  menu,
  children,
}: {
  menu: (controls: GameCentreMenuControls) => React.ReactNode;
  children: React.ReactNode;
}) {
  const t = useTokens();
  const { width } = useWindowDimensions();
  const menuWidth = Math.min(330, width - PEEK);
  const progress = useSharedValue(0);
  const [open, setOpen] = React.useState(false);
  const [reduceMotion, setReduceMotion] = React.useState(false);

  React.useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduceMotion)
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion,
    );
    return () => sub.remove();
  }, []);

  // Where the menu is heading, read by toggle without making the controls change.
  const target = React.useRef<0 | 1>(0);
  const settled = React.useCallback((isOpen: boolean) => {
    target.current = isOpen ? 1 : 0;
    setOpen(isOpen);
  }, []);

  const animateTo = React.useCallback(
    (to: 0 | 1) => {
      target.current = to;
      // Start the slide first; the re-render for the open state follows it.
      progress.value = withTiming(
        to,
        {
          duration: reduceMotion ? 0 : OPEN_MS,
          easing: Easing.out(Easing.cubic),
        },
        (finished) => {
          if (finished) runOnJS(settled)(to === 1);
        },
      );
      if (to === 1) setOpen(true);
    },
    [progress, reduceMotion, settled],
  );

  const controls = React.useMemo<GameCentreMenuControls>(
    () => ({
      toggle: () => animateTo(target.current === 1 ? 0 : 1),
      close: (after) => {
        if (!after) {
          animateTo(0);
          return;
        }
        // Open the next screen straight away; shut the menu once that screen covers it.
        after();
        target.current = 0;
        setTimeout(() => {
          progress.value = 0;
          settled(false);
        }, 450);
      },
    }),
    [animateTo, progress, settled],
  );

  React.useEffect(() => {
    if (!open) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      animateTo(0);
      return true;
    });
    return () => sub.remove();
  }, [animateTo, open]);

  const swipeClosed = Gesture.Pan()
    .enabled(open)
    .activeOffsetX([-12, 12])
    .failOffsetY([-16, 16])
    .onUpdate((event) => {
      progress.value = Math.min(
        1,
        Math.max(0, 1 + event.translationX / menuWidth),
      );
    })
    .onEnd((event) => {
      const close = progress.value < 0.6 || event.velocityX < -500;
      progress.value = withTiming(
        close ? 0 : 1,
        { duration: 200, easing: Easing.out(Easing.cubic) },
        (finished) => {
          if (finished) runOnJS(settled)(!close);
        },
      );
    });

  const swipeOpen = Gesture.Pan()
    .enabled(!open)
    .activeOffsetX(16)
    .failOffsetY([-24, 24])
    .onUpdate((event) => {
      progress.value = Math.min(1, Math.max(0, event.translationX / menuWidth));
    })
    .onEnd((event) => {
      const openIt = progress.value > 0.25 || event.velocityX > 400;
      if (openIt) runOnJS(setOpen)(true);
      progress.value = withTiming(
        openIt ? 1 : 0,
        { duration: 200, easing: Easing.out(Easing.cubic) },
        (finished) => {
          if (finished) runOnJS(settled)(openIt);
        },
      );
    });

  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * menuWidth }],
  }));
  const menuStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(progress.value, [0, 1], [-menuWidth * 0.3, 0]),
      },
    ],
  }));

  return (
    <GameCentreMenuContext.Provider value={controls}>
      <GameCentreMenuOpenContext.Provider value={open}>
        {/* While open, a drag anywhere (the menu or the Game Centre edge) moves it back. */}
        <GestureDetector gesture={swipeClosed}>
          <View
            style={{
              flex: 1,
              backgroundColor: t.color.background,
              overflow: "hidden",
            }}
          >
            <Animated.View
              style={[StyleSheet.absoluteFill, { width: menuWidth }, menuStyle]}
              accessibilityElementsHidden={!open}
              importantForAccessibility={open ? "auto" : "no-hide-descendants"}
              pointerEvents={open ? "auto" : "none"}
            >
              {menu(controls) as any}
            </Animated.View>
            <Animated.View
              style={[
                { flex: 1, backgroundColor: t.color.background },
                contentStyle,
              ]}
            >
              <View
                style={{ flex: 1 }}
                accessibilityElementsHidden={open}
                importantForAccessibility={
                  open ? "no-hide-descendants" : "auto"
                }
              >
                {children as any}
              </View>
              {!open ? (
                <GestureDetector gesture={swipeOpen}>
                  <View
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: OPEN_EDGE,
                    }}
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                  />
                </GestureDetector>
              ) : null}
              {open ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close menu"
                  onPress={() => animateTo(0)}
                  style={StyleSheet.absoluteFill}
                />
              ) : null}
            </Animated.View>
          </View>
        </GestureDetector>
      </GameCentreMenuOpenContext.Provider>
    </GameCentreMenuContext.Provider>
  );
}
