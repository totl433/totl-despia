import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeOut, ZoomIn } from 'react-native-reanimated';

export type HomeGameweekMenuItem = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
};

const MENU_WIDTH = 180;

/**
 * "…" beside the gameweek title, opening an iOS-style dark menu (Figma "View menu", 113:26844)
 * with Roundup and the grid / card view switch.
 */
export default function HomeGameweekMenu({ items }: { items: HomeGameweekMenuItem[] }) {
  const buttonRef = React.useRef<View>(null);
  const [anchor, setAnchor] = React.useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const { width: screenW } = useWindowDimensions();

  const open = React.useCallback(() => {
    buttonRef.current?.measureInWindow((x, y, w, h) => setAnchor({ x, y, w, h }));
  }, []);
  const close = React.useCallback(() => setAnchor(null), []);

  if (!items.length) return null;

  const right = anchor ? Math.max(8, screenW - (anchor.x + anchor.w)) : 0;

  return (
    <>
      <Pressable
        ref={buttonRef}
        accessibilityRole="button"
        accessibilityLabel="Gameweek options"
        onPress={open}
        hitSlop={8}
        style={({ pressed }) => [styles.button, { opacity: pressed ? 0.7 : 1 }]}
      >
        <Ionicons name="ellipsis-horizontal" size={17} color="#000000" />
      </Pressable>

      <Modal visible={!!anchor} transparent animationType="none" onRequestClose={close}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close menu" />
        {anchor ? (
          <Animated.View
            entering={ZoomIn.duration(160)}
            exiting={FadeOut.duration(120)}
            style={[styles.menu, { top: anchor.y + anchor.h + 6, right }]}
          >
            {items.map((item, i) => (
              <Pressable
                key={item.key}
                accessibilityRole="menuitem"
                onPress={() => {
                  close();
                  item.onPress();
                }}
                style={({ pressed }) => [
                  styles.item,
                  i > 0 && styles.divider,
                  pressed && { backgroundColor: 'rgba(255,255,255,0.08)' },
                ]}
              >
                <Ionicons name={item.icon} size={18} color="#FFFFFF" style={{ width: 22 }} />
                <Text style={styles.label}>{item.label}</Text>
              </Pressable>
            ))}
          </Animated.View>
        ) : null}
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 0.744,
    borderColor: '#E5E6EA',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menu: {
    position: 'absolute',
    width: MENU_WIDTH,
    borderRadius: 12,
    backgroundColor: '#353536',
    overflow: 'hidden',
    transformOrigin: 'top right',
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  item: {
    minHeight: 44,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.12)',
  },
  label: {
    fontSize: 17,
    color: '#FFFFFF',
  },
});
