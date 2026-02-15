import React from 'react';
import { Pressable, View } from 'react-native';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import Ionicons from '@expo/vector-icons/Ionicons';
import { TotlText, useTokens } from '@totl/ui';

export default function LeagueRulesSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const t = useTokens();
  const headingColor = '#0F172A';
  const bodyColor = '#334155';
  const ref = React.useRef<BottomSheetModal>(null);
  const snapPoints = React.useMemo(() => [410], []);

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
      <BottomSheetView style={{ paddingHorizontal: 18, paddingTop: 10, paddingBottom: 52 }}>
        <View style={{ alignItems: 'flex-end', marginBottom: 8 }}>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close rules"
            hitSlop={10}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, padding: 2 })}
          >
            <Ionicons name="close" size={24} color={t.color.muted} />
          </Pressable>
        </View>
        <View style={{ paddingHorizontal: 2 }}>
          <View style={{ marginBottom: 20 }}>
            <TotlText
              style={{
                color: '#0F766E',
                fontSize: 14,
                lineHeight: 18,
                fontWeight: '900',
                letterSpacing: 0.8,
                textTransform: 'uppercase',
              }}
            >
              How to Win the Week
            </TotlText>
            <TotlText style={{ marginTop: 8, color: bodyColor, fontSize: 16, lineHeight: 24, fontWeight: '500' }}>
              The player with the most correct predictions wins.
            </TotlText>
          </View>

          <View>
            <TotlText
              style={{
                color: '#0F766E',
                fontSize: 14,
                lineHeight: 18,
                fontWeight: '900',
                letterSpacing: 0.8,
                textTransform: 'uppercase',
              }}
            >
              Unicorns
            </TotlText>
            <TotlText style={{ marginTop: 8, color: bodyColor, fontSize: 16, lineHeight: 24, fontWeight: '500' }}>
              In Mini-Leagues with 3 or more players, if you're the only person to correctly predict a fixture, that's a
              Unicorn. In ties, the player with most Unicorns wins!
            </TotlText>
          </View>
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
}

