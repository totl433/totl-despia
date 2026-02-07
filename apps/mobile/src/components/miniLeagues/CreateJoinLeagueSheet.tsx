import React from 'react';
import { Alert, TextInput, View } from 'react-native';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { TotlText, useTokens } from '@totl/ui';
import GlobalButton from '../GlobalButton';

/**
 * CreateJoinLeagueSheet
 * Light-theme bottom sheet (no X) to match Despia's Create/Join tray structure.
 */
export default function CreateJoinLeagueSheet({
  open,
  onClose,
  joinCode,
  setJoinCode,
  joinError,
  joining = false,
  onPressCreate,
  onPressJoin,
}: {
  open: boolean;
  onClose: () => void;
  joinCode: string;
  setJoinCode: (next: string) => void;
  joinError?: string | null;
  joining?: boolean;
  onPressCreate: () => void;
  onPressJoin: () => void;
}) {
  const t = useTokens();
  const ref = React.useRef<BottomSheetModal>(null);
  const snapPoints = React.useMemo(() => [432], []);

  React.useEffect(() => {
    if (open) {
      requestAnimationFrame(() => ref.current?.present());
      return;
    }
    ref.current?.dismiss();
  }, [open]);

  const normalizedCode = joinCode.trim().toUpperCase();
  const canJoin = normalizedCode.length === 5 && !joining;

  return (
    <BottomSheetModal
      ref={ref}
      snapPoints={snapPoints}
      enablePanDownToClose
      onDismiss={onClose}
      backgroundStyle={{ backgroundColor: t.color.surface }}
      handleIndicatorStyle={{ backgroundColor: t.color.border }}
      backdropComponent={(props) => (
        <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.35} pressBehavior="close" />
      )}
    >
      <BottomSheetView style={{ paddingHorizontal: 18, paddingTop: 6, paddingBottom: 30 }}>
        <TotlText style={{ fontFamily: 'Gramatika-Medium', fontSize: 22, lineHeight: 22, color: '#000000' }}>
          Create or join
        </TotlText>

        <View style={{ height: 18 }} />

        <TotlText style={{ fontFamily: 'Gramatika-Medium', fontSize: 14, lineHeight: 14, color: '#ADADB1' }}>
          Create a league
        </TotlText>
        <View style={{ height: 10 }} />
        <GlobalButton title="Create league" variant="primary" size="sm" onPress={onPressCreate} />

        <View style={{ height: 22 }} />

        <TotlText style={{ fontFamily: 'Gramatika-Medium', fontSize: 14, lineHeight: 14, color: '#ADADB1' }}>
          join with code
        </TotlText>
        <View style={{ height: 10 }} />
        <TextInput
          value={joinCode}
          onChangeText={(txt) => setJoinCode(txt.toUpperCase())}
          placeholder="ABCDE"
          placeholderTextColor={t.color.muted}
          autoCapitalize="characters"
          maxLength={5}
          style={{
            width: '100%',
            height: 56,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: t.color.border,
            backgroundColor: t.color.surface2,
            paddingHorizontal: 16,
            fontFamily: 'Gramatika-Medium',
            fontSize: 14,
            lineHeight: 14,
            letterSpacing: 4,
            color: '#000000',
            textAlign: 'center',
          }}
          returnKeyType="done"
          onSubmitEditing={() => {
            if (!canJoin) {
              if (normalizedCode.length !== 5) {
                Alert.alert('Invalid code', 'League codes are 5 characters.', [{ text: 'OK' }]);
              }
              return;
            }
            onPressJoin();
          }}
        />

        {joinError ? (
          <>
            <View style={{ height: 10 }} />
            <View
              style={{
                borderRadius: 14,
                borderWidth: 1,
                borderColor: 'rgba(239,68,68,0.22)',
                backgroundColor: 'rgba(239,68,68,0.08)',
                paddingHorizontal: 12,
                paddingVertical: 10,
              }}
            >
              <TotlText style={{ fontFamily: 'System', fontSize: 13, lineHeight: 16, fontWeight: '700', color: '#DC2626' }}>
                {joinError}
              </TotlText>
            </View>
          </>
        ) : null}

        <View style={{ height: 12 }} />
        <GlobalButton
          title={joining ? 'Joining…' : 'Join'}
          variant="secondary"
          size="sm"
          active={canJoin}
          disabled={!canJoin}
          onPress={onPressJoin}
        />
      </BottomSheetView>
    </BottomSheetModal>
  );
}

