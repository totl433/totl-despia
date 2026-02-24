import React from 'react';
import { Animated, PanResponder, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTokens } from '@totl/ui';

export default function ShareResultsTray({
  topGapPx,
  footerReserved,
  footerBottomInset = 8,
  contentTopInset = 0,
  indicator,
  indicatorBottomOffset = 10,
  indicatorReservedHeight = 30,
  onClose,
  children,
  footer,
}: {
  topGapPx: number;
  footerReserved: number;
  footerBottomInset?: number;
  contentTopInset?: number;
  indicator?: React.JSX.Element | null;
  indicatorBottomOffset?: number;
  indicatorReservedHeight?: number;
  onClose: () => void;
  children: React.JSX.Element | null;
  footer: React.JSX.Element;
}) {
  const t = useTokens();
  const trayTranslateY = React.useRef(new Animated.Value(0)).current;

  const trayPanResponder = React.useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_evt, gestureState) =>
          gestureState.dy > 4 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
        onPanResponderMove: (_evt, gestureState) => {
          if (gestureState.dy > 0) trayTranslateY.setValue(gestureState.dy);
        },
        onPanResponderRelease: (_evt, gestureState) => {
          if (gestureState.dy > 120 || gestureState.vy > 1.1) {
            onClose();
            return;
          }
          trayTranslateY.setValue(0);
        },
        onPanResponderTerminate: () => {
          trayTranslateY.setValue(0);
        },
      }),
    [onClose, trayTranslateY]
  );

  React.useEffect(() => {
    trayTranslateY.setValue(0);
  }, [trayTranslateY]);

  return (
    <View style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.28)' }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Close share tray" onPress={onClose} style={{ height: topGapPx }} />
      <Animated.View
        style={{
          flex: 1,
          backgroundColor: t.color.background,
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          overflow: 'hidden',
          transform: [{ translateY: trayTranslateY }],
        }}
      >
        <View {...trayPanResponder.panHandlers} style={{ alignItems: 'center', paddingTop: 8 }}>
          <View
            style={{
              width: 34,
              height: 4,
              borderRadius: 999,
              backgroundColor: t.color.border,
            }}
          />
        </View>

        <View
          style={{
            height: 56,
            paddingHorizontal: t.space[4],
            paddingBottom: 8,
            alignItems: 'flex-end',
            justifyContent: 'center',
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={onClose}
            hitSlop={14}
            style={({ pressed }) => ({
              width: 36,
              height: 36,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 18,
              opacity: pressed ? 0.75 : 1,
            })}
          >
            <Ionicons name="close" size={24} color={t.color.text} />
          </Pressable>
        </View>

        <View
          style={{
            flex: 1,
            paddingTop: contentTopInset,
            marginBottom: footerReserved + (indicator ? indicatorReservedHeight : 0),
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {children}
        </View>

        {indicator ? (
          <View
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: footerReserved + indicatorBottomOffset,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {indicator}
          </View>
        ) : null}

        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            paddingTop: 10,
            paddingBottom: footerBottomInset,
            paddingHorizontal: t.space[4],
            backgroundColor: t.color.background,
            borderTopWidth: 1,
            borderTopColor: 'rgba(148,163,184,0.22)',
          }}
        >
          {footer}
        </View>
      </Animated.View>
    </View>
  );
}
