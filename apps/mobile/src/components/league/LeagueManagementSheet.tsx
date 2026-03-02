import React from 'react';
import { Alert, Pressable, View } from 'react-native';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { TotlText, useTokens } from '@totl/ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type LeagueManagementMember = { id: string; name: string };

export default function LeagueManagementSheet({
  open,
  onClose,
  leagueName,
  members,
  currentUserId,
  onRemoveMember,
  onEndLeague,
}: {
  open: boolean;
  onClose: () => void;
  leagueName: string;
  members: LeagueManagementMember[];
  currentUserId: string | null;
  onRemoveMember: (member: LeagueManagementMember) => Promise<void>;
  onEndLeague: () => Promise<void>;
}) {
  const t = useTokens();
  const insets = useSafeAreaInsets();
  const ref = React.useRef<BottomSheetModal>(null);
  const snapPoints = React.useMemo(() => [400], []);

  const otherMembers = React.useMemo(
    () => members.filter((m) => String(m.id) !== String(currentUserId)),
    [members, currentUserId]
  );

  React.useEffect(() => {
    if (open) {
      requestAnimationFrame(() => ref.current?.present());
      return;
    }
    ref.current?.dismiss();
  }, [open]);

  const handleRemove = (member: LeagueManagementMember) => {
    Alert.alert(
      'Remove Member',
      `Are you sure you want to remove "${member.name}" from the league? They will need the league code to rejoin.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await onRemoveMember(member);
              onClose();
            } catch (e: any) {
              Alert.alert('Couldn’t remove member', e?.message ?? 'Failed to remove member. Please try again.', [
                { text: 'OK' },
              ]);
            }
          },
        },
      ]
    );
  };

  const handleEndLeague = () => {
    Alert.alert(
      'End League',
      `Are you absolutely sure you want to permanently end the league "${leagueName}"? This will remove all members and delete the league forever. This action cannot be undone!`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, End League',
          style: 'destructive',
          onPress: async () => {
            try {
              await onEndLeague();
              onClose();
            } catch (e: any) {
              Alert.alert('Couldn’t end league', e?.message ?? 'Failed to end league. Please try again.', [
                { text: 'OK' },
              ]);
            }
          },
        },
      ]
    );
  };

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
      <BottomSheetScrollView
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingTop: 8,
          paddingBottom: insets.bottom + 24,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <TotlText style={{ fontSize: 20, lineHeight: 26, fontFamily: t.font.bold, color: t.color.text }}>
            League Management
          </TotlText>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={10}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, padding: 4 })}
          >
            <Ionicons name="close" size={24} color={t.color.muted} />
          </Pressable>
        </View>

        <TotlText
          style={{
            fontSize: 14,
            lineHeight: 18,
            fontFamily: t.font.medium,
            color: t.color.muted,
            marginBottom: 12,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}
        >
          Remove Members
        </TotlText>
        <View style={{ marginBottom: 24 }}>
          {otherMembers.length === 0 ? (
            <TotlText style={{ fontSize: 14, color: t.color.muted, fontFamily: t.font.regular }}>
              No other members to remove
            </TotlText>
          ) : (
            otherMembers.map((member) => (
              <View
                key={member.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                  backgroundColor: t.color.surface2 ?? 'rgba(148,163,184,0.1)',
                  borderRadius: 10,
                  marginBottom: 8,
                }}
              >
                <TotlText style={{ fontSize: 15, fontFamily: t.font.medium, color: t.color.text }}>{member.name}</TotlText>
                <Pressable
                  onPress={() => handleRemove(member)}
                  style={({ pressed }) => ({
                    paddingVertical: 6,
                    paddingHorizontal: 12,
                    backgroundColor: 'rgba(220,38,38,0.15)',
                    borderRadius: 8,
                    opacity: pressed ? 0.8 : 1,
                  })}
                >
                  <TotlText style={{ fontSize: 12, fontFamily: t.font.bold, color: t.color.danger }}>Remove</TotlText>
                </Pressable>
              </View>
            ))
          )}
        </View>

        <View style={{ borderTopWidth: 1, borderTopColor: t.color.border, paddingTop: 16 }}>
          <Pressable
            onPress={handleEndLeague}
            style={({ pressed }) => ({
              width: '100%',
              paddingVertical: 14,
              backgroundColor: '#DC2626',
              borderRadius: 10,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              opacity: pressed ? 0.9 : 1,
            })}
          >
            <Ionicons name="trash-outline" size={18} color="#fff" />
            <TotlText style={{ fontSize: 15, fontFamily: t.font.bold, color: '#fff' }}>End League</TotlText>
          </Pressable>
        </View>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}
