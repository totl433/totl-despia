import React from 'react';
import { Alert, Keyboard, Pressable, View } from 'react-native';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { TotlText, useTokens } from '@totl/ui';
import { KeyboardController } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type LeagueOverflowAction =
  | 'editBadge'
  | 'resetBadge'
  | 'inviteLeague'
  | 'inviteChat'
  | 'shareLeagueCode'
  | 'leave';

function MenuRow({
  label,
  icon,
  destructive = false,
  onPress,
}: {
  label: string;
  icon: React.JSX.Element;
  destructive?: boolean;
  onPress: () => void;
}) {
  const t = useTokens();
  const textColor = destructive ? '#DC2626' : '#000000';
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 44,
        paddingVertical: 10,
        paddingHorizontal: 18,
        borderRadius: 12,
        backgroundColor: pressed ? 'rgba(148,163,184,0.14)' : 'transparent',
      })}
    >
      <View style={{ width: 22, alignItems: 'center', marginRight: 12 }}>{icon}</View>
      <TotlText style={{ flex: 1, fontFamily: 'System', fontSize: 16, lineHeight: 20, color: textColor }}>
        {label}
      </TotlText>
    </Pressable>
  );
}

/**
 * LeagueOverflowMenu
 * Shared native menu shown from the League header ellipsis.
 */
export default function LeagueOverflowMenu({
  open,
  onClose,
  onAction,
  extraItems = [],
  showBadgeActions = true,
  showResetBadge = false,
  showCoreActions = true,
  showInviteChat = true,
}: {
  open: boolean;
  onClose: () => void;
  onAction: (action: LeagueOverflowAction) => void;
  extraItems?: Array<{ key: string; label: string; icon: React.JSX.Element; onPress: () => void }>;
  showBadgeActions?: boolean;
  showResetBadge?: boolean;
  showCoreActions?: boolean;
  showInviteChat?: boolean;
}) {
  const t = useTokens();
  const insets = useSafeAreaInsets();
  const ref = React.useRef<BottomSheetModal>(null);
  const snapPoints = React.useMemo(() => {
    // Roughly 54px per row + chrome. Keep this simple and forgiving.
    const base = 236;
    const badgeRows = showBadgeActions ? (showResetBadge ? 2 : 1) : 0;
    const coreRows = showCoreActions ? (showInviteChat ? 4 : 3) : 0; // invite league, invite chat (optional), share, leave
    const extraRows = extraItems.length;
    const rows = badgeRows + coreRows + extraRows;
    return [Math.min(520, base + rows * 48)];
  }, [extraItems.length, showBadgeActions, showCoreActions, showInviteChat, showResetBadge]);

  React.useEffect(() => {
    if (open) {
      // Native UX: if the keyboard is open (chat composer), dismiss it before showing the menu.
      const wasKeyboardVisible = KeyboardController.isVisible();
      if (wasKeyboardVisible) {
        Keyboard.dismiss();
        let presented = false;
        const present = () => {
          if (presented) return;
          presented = true;
          requestAnimationFrame(() => ref.current?.present());
        };
        const sub = Keyboard.addListener('keyboardDidHide', present);
        // Fallback in case we miss the event.
        const timeout = setTimeout(present, 500);
        return () => {
          sub.remove();
          clearTimeout(timeout);
        };
      }

      requestAnimationFrame(() => ref.current?.present());
      return;
    }
    ref.current?.dismiss();
  }, [open]);

  return (
    <BottomSheetModal
      ref={ref}
      snapPoints={snapPoints}
      enablePanDownToClose
      onDismiss={onClose}
      backgroundStyle={{ backgroundColor: t.color.surface }}
      handleIndicatorStyle={{ backgroundColor: t.color.border }}
      // Ensure the sheet stays above the keyboard when it's open.
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      // Keep the sheet background flush to the bottom edge; pad content instead.
      bottomInset={0}
      enableBlurKeyboardOnGesture
      backdropComponent={(props) => (
        <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.5} pressBehavior="close" />
      )}
    >
      <BottomSheetView style={{ paddingTop: 8, paddingBottom: insets.bottom + 12 }}>
        {extraItems.map((it) => (
          <MenuRow key={it.key} label={it.label} icon={it.icon} onPress={it.onPress} />
        ))}
        {showBadgeActions ? (
          <>
            <MenuRow
              label="Edit League Badge"
              icon={<Ionicons name="image-outline" size={18} color={t.color.muted} />}
              onPress={() => onAction('editBadge')}
            />
            {showResetBadge ? (
              <MenuRow
                label="Reset League Badge"
                icon={<Ionicons name="refresh-outline" size={18} color="#000000" />}
                onPress={() => {
                  Alert.alert('Reset Badge', 'Remove the current league badge?', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Remove', style: 'destructive', onPress: () => onAction('resetBadge') },
                  ]);
                }}
              />
            ) : null}
          </>
        ) : null}
        {showCoreActions ? (
          <>
            <MenuRow
              label="Invite to mini league"
              icon={<Ionicons name="add" size={20} color={t.color.muted} />}
              onPress={() => onAction('inviteLeague')}
            />
            {showInviteChat ? (
              <MenuRow
                label="Invite to chat"
                icon={<Ionicons name="chatbubble-ellipses-outline" size={18} color={t.color.muted} />}
                onPress={() => onAction('inviteChat')}
              />
            ) : null}
            <MenuRow
              label="Share league code"
              icon={<Ionicons name="link-outline" size={18} color={t.color.muted} />}
              onPress={() => onAction('shareLeagueCode')}
            />
            <MenuRow
              label="Leave"
              destructive
              icon={<Ionicons name="log-out-outline" size={18} color="#DC2626" />}
              onPress={() => {
                Alert.alert('Leave League', 'Are you sure you want to leave this league?', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Leave', style: 'destructive', onPress: () => onAction('leave') },
                ]);
              }}
            />
          </>
        ) : null}
      </BottomSheetView>
    </BottomSheetModal>
  );
}

