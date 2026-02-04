import React from 'react';
import { Pressable, View } from 'react-native';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { TotlText, useTokens } from '@totl/ui';

export default function PredictionsHowToSheet({
  open,
  onClose,
  onDontShowAgain,
}: {
  open: boolean;
  onClose: () => void;
  onDontShowAgain: () => void;
}) {
  const t = useTokens();
  const ref = React.useRef<BottomSheetModal>(null);
  const snapPoints = React.useMemo(() => [360], []);

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
        <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.35} pressBehavior="close" />
      )}
    >
      <BottomSheetView style={{ paddingHorizontal: 18, paddingTop: 8, paddingBottom: 18 }}>
        <TotlText style={{ fontFamily: 'Gramatika-Medium', fontSize: 22, lineHeight: 24, color: t.color.text }}>
          Quick tip
        </TotlText>

        <View style={{ height: 12 }} />

        <TotlText variant="muted" style={{ lineHeight: 20 }}>
          Swipe left for a Home Win, right for an Away Win, or down for a Draw. You can also use the buttons at the bottom.
        </TotlText>

        <View style={{ height: 18 }} />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Got it"
          onPress={onClose}
          style={({ pressed }) => ({
            height: 54,
            borderRadius: 14,
            backgroundColor: '#1C8376',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.92 : 1,
          })}
        >
          <TotlText style={{ color: '#FFFFFF', fontWeight: '900' }}>Got it</TotlText>
        </Pressable>

        <View style={{ height: 10 }} />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Don't show this again"
          onPress={onDontShowAgain}
          style={({ pressed }) => ({
            paddingVertical: 10,
            alignItems: 'center',
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <TotlText variant="muted" style={{ textDecorationLine: 'underline' }}>
            Don&apos;t show this again
          </TotlText>
        </Pressable>
      </BottomSheetView>
    </BottomSheetModal>
  );
}

