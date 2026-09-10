import React from 'react';
import { Pressable, View } from 'react-native';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { TotlText, useTokens } from '@totl/ui';

/** Rules sheet for Retro Totl Daily — The Players. */
export default function RetroPlayersRulesSheet({
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
          The Players — Rules
        </TotlText>

        <View style={{ height: 14 }} />

        <RuleBlock
          title="Guess the club"
          body="Each card shows a Premier League player and one season. Pick which club he played for that season."
        />
        <RuleBlock
          title="One season"
          body="The clue is a single year — e.g. 96/97. After you answer, you’ll see the full spell at that club."
        />
        <RuleBlock
          title="Gets harder"
          body="Later cards lean on short spells — and often put another club from their career in the options."
        />
        <RuleBlock
          title="Ten seconds"
          body="Swipe the card or tap a club. If the timer hits zero, that run ends."
        />
        <RuleBlock
          title="Stay alive"
          body="Get it right to keep going. Wrong answer or timeout — check the reveal, then see your score."
        />
        <RuleBlock
          title="Appearances"
          body="Totals are Premier League league games for that club across their career."
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
