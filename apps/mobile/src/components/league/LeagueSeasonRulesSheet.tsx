import React from 'react';
import { Pressable, View } from 'react-native';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import Ionicons from '@expo/vector-icons/Ionicons';
import { TotlText, useTokens } from '@totl/ui';

export default function LeagueSeasonRulesSheet({
  open,
  onClose,
  isLateStartingLeague,
}: {
  open: boolean;
  onClose: () => void;
  isLateStartingLeague: boolean;
}) {
  const t = useTokens();
  const bodyColor = '#334155';
  const mutedColor = '#64748B';
  const ref = React.useRef<BottomSheetModal>(null);
  const snapPoints = React.useMemo(() => [430], []);

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
              Points System
            </TotlText>
            <TotlText style={{ marginTop: 8, color: bodyColor, fontSize: 16, lineHeight: 24, fontWeight: '500' }}>
              Win the week – 3 points{'\n'}
              Draw – 1 point{'\n'}
              Lose – 0 points
            </TotlText>
          </View>

          <View style={{ marginBottom: isLateStartingLeague ? 18 : 0 }}>
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
              Ties
            </TotlText>
            <TotlText style={{ marginTop: 8, color: bodyColor, fontSize: 16, lineHeight: 24, fontWeight: '500' }}>
              If two or more players are tied on Points in the table, the player with the most overall Unicorns in the mini
              league is ranked higher.
            </TotlText>
          </View>

          {isLateStartingLeague ? (
            <View>
              <TotlText
                style={{
                  color: '#0F766E',
                  fontSize: 14,
                  lineHeight: 18,
                  fontWeight: '900',
                  letterSpacing: 0.8,
                  textTransform: 'uppercase',
                  marginBottom: 8,
                }}
              >
                Late-Start League
              </TotlText>
              <TotlText variant="muted" style={{ color: mutedColor, fontSize: 15, lineHeight: 22 }}>
                Note: This mini league started after GW1, so CP shows correct predictions since it began.
              </TotlText>
            </View>
          ) : null}
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
}

