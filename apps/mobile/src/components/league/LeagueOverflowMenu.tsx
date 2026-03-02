import React from 'react';
import { Alert, Keyboard, Pressable, useColorScheme, View } from 'react-native';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { TotlText, useTokens } from '@totl/ui';
import { KeyboardController } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemePreference } from '../../context/ThemePreferenceContext';

export type LeagueOverflowAction =
  | 'manage'
  | 'editBadge'
  | 'resetBadge'
  | 'inviteLeague'
  | 'inviteChat'
  | 'shareLeagueCode'
  | 'leave';

/** Text/icon color for bottom sheet. Check both app theme and system - sheet may render in portal. */
function useSheetTextColor() {
  const t = useTokens();
  const { isDark: appDark } = useThemePreference();
  const systemDark = useColorScheme() === 'dark';
  const isDark = appDark || systemDark;
  return {
    text: isDark ? '#F8FAFC' : t.color.text,
    danger: t.color.danger,
  };
}

function MenuRow({
  label,
  icon,
  destructive = false,
  onPress,
  textColor,
}: {
  label: string;
  icon: React.JSX.Element;
  destructive?: boolean;
  onPress: () => void;
  textColor: string;
}) {
  const t = useTokens();
  const { danger } = useSheetTextColor();
  const color = destructive ? danger : textColor;
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
      <TotlText style={{ flex: 1, fontFamily: t.font.regular, fontSize: 16, lineHeight: 20, color }}>
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
  showManage = false,
  menuTextColor,
}: {
  open: boolean;
  onClose: () => void;
  onAction: (action: LeagueOverflowAction) => void;
  extraItems?: Array<{ key: string; label: string; icon: React.JSX.Element; onPress: () => void }>;
  showBadgeActions?: boolean;
  showResetBadge?: boolean;
  showCoreActions?: boolean;
  showInviteChat?: boolean;
  /** Show Manage option (league creator only). */
  showManage?: boolean;
  /** Text/icon color for menu items. Pass from parent to avoid portal/context issues. */
  menuTextColor?: string;
}) {
  const t = useTokens();
  const fallback = useSheetTextColor();
  const sheetTextColor = menuTextColor ?? fallback.text;
  const insets = useSafeAreaInsets();
  const ref = React.useRef<BottomSheetModal>(null);
  const snapPoints = React.useMemo(() => {
    // Roughly 54px per row + chrome. Keep this simple and forgiving.
    const base = 236;
    const manageRows = showManage ? 1 : 0;
    const badgeRows = showBadgeActions ? (showResetBadge ? 2 : 1) : 0;
    const coreRows = showCoreActions ? (showInviteChat ? 4 : 3) : 0; // invite league, invite chat (optional), share, leave
    const extraRows = extraItems.length;
    const rows = manageRows + badgeRows + coreRows + extraRows;
    return [Math.min(520, base + rows * 48)];
  }, [extraItems.length, showBadgeActions, showCoreActions, showInviteChat, showManage, showResetBadge]);

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
        {showManage ? (
          <MenuRow
            label="Manage"
            icon={<Ionicons name="settings-outline" size={18} color={sheetTextColor} />}
            onPress={() => onAction('manage')}
            textColor={sheetTextColor}
          />
        ) : null}
        {extraItems.map((it) => (
          <MenuRow key={it.key} label={it.label} icon={it.icon} onPress={it.onPress} textColor={sheetTextColor} />
        ))}
        {showBadgeActions ? (
          <>
            <MenuRow
              label="Edit League Badge"
              icon={<Ionicons name="image-outline" size={18} color={sheetTextColor} />}
              onPress={() => onAction('editBadge')}
              textColor={sheetTextColor}
            />
            {showResetBadge ? (
              <MenuRow
                label="Reset League Badge"
                icon={<Ionicons name="refresh-outline" size={18} color={sheetTextColor} />}
                textColor={sheetTextColor}
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
              icon={<Ionicons name="add" size={20} color={sheetTextColor} />}
              onPress={() => onAction('inviteLeague')}
              textColor={sheetTextColor}
            />
            {showInviteChat ? (
            <MenuRow
              label="Invite to chat"
              icon={<Ionicons name="chatbubble-ellipses-outline" size={18} color={sheetTextColor} />}
                onPress={() => onAction('inviteChat')}
              textColor={sheetTextColor}
              />
            ) : null}
            <MenuRow
              label="Share league code"
              icon={<Ionicons name="link-outline" size={18} color={sheetTextColor} />}
              onPress={() => onAction('shareLeagueCode')}
              textColor={sheetTextColor}
            />
            <MenuRow
              label="Leave"
              destructive
              textColor={sheetTextColor}
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

