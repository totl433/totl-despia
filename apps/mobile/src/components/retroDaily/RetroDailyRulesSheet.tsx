import React from 'react';
import { Pressable, View } from 'react-native';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { TotlText, useTokens } from '@totl/ui';

export default function RetroDailyRulesSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const t = useTokens();
  const ref = React.useRef<BottomSheetModal>(null);
  const snapPoints = React.useMemo(() => ['62%'], []);

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
      <BottomSheetScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 8, paddingBottom: 36 }}>
        <TotlText style={{ fontFamily: 'Gramatika-Medium', fontSize: 22, lineHeight: 26, color: t.color.text }}>
          Retro Totl Daily — Rules
        </TotlText>

        <View style={{ height: 14 }} />

        <RuleBlock
          title="One season a day"
          body="Each day unlocks a Premier League season from the past. Everyone gets the same 10 fixtures."
        />
        <RuleBlock
          title="Guess the result"
          body="Swipe left for Home, right for Away, or down for a Draw — or use the buttons. You get one guess per card."
        />
        <RuleBlock
          title="Ten seconds"
          body="The bar above the card is your clock. It turns red as time runs out — if it hits zero, you’re out."
        />
        <RuleBlock
          title="Stay alive"
          body="Get it right to keep going. Get it wrong (or time out) and that day’s run ends after the reveal."
        />
        <RuleBlock
          title="Your score"
          body="Score is how far you get through the 10. Nail all 10 and we’ll make some noise."
        />
        <RuleBlock
          title="Fair play"
          body="Live game: one attempt per day after 8am UK. This admin build lets you replay as much as you like."
        />

        <View style={{ height: 10 }} />

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
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

function RuleBlock({ title, body }: { title: string; body: string }) {
  const t = useTokens();
  return (
    <View style={{ marginBottom: 14 }}>
      <TotlText style={{ fontWeight: '800', fontSize: 15, color: t.color.text, marginBottom: 4 }}>{title}</TotlText>
      <TotlText variant="muted" style={{ lineHeight: 20 }}>
        {body}
      </TotlText>
    </View>
  );
}
