import React from 'react';
import { Alert, Pressable, View } from 'react-native';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { TotlText, useTokens } from '@totl/ui';

export type LeagueMenuAction = 'editBadge' | 'resetBadge' | 'invitePlayers' | 'shareLeagueCode' | 'leave';

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
 * LeagueMenuSheet
 * Native menu shown from the League header ellipsis, matching the Despia web menu items.
 */
export default function LeagueMenuSheet({
  open,
  onClose,
  onAction,
  showResetBadge = false,
}: {
  open: boolean;
  onClose: () => void;
  onAction: (action: LeagueMenuAction) => void;
  showResetBadge?: boolean;
}) {
  const t = useTokens();
  const ref = React.useRef<BottomSheetModal>(null);
  const snapPoints = React.useMemo(() => [showResetBadge ? 356 : 302], [showResetBadge]);

  React.useEffect(() => {
    if (open) {
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
      backdropComponent={(props) => (
        <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.5} pressBehavior="close" />
      )}
    >
      <BottomSheetView style={{ paddingTop: 8, paddingBottom: 26 }}>
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
        <MenuRow
          label="Invite players"
          icon={<Ionicons name="add" size={20} color={t.color.muted} />}
          onPress={() => onAction('invitePlayers')}
        />
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
            // Confirm leave from the parent (keeps business logic centralized),
            // but show a fast native confirmation affordance here if desired.
            Alert.alert('Leave League', 'Are you sure you want to leave this league?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Leave', style: 'destructive', onPress: () => onAction('leave') },
            ]);
          }}
        />
      </BottomSheetView>
    </BottomSheetModal>
  );
}

