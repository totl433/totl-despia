import React from 'react';
import { Pressable, View } from 'react-native';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { TotlText, useTokens } from '@totl/ui';

import { PLAYERS_COLORS } from './playersTheme';

/** Shootout rules, in the same sheet as The Players' own rules (RetroPlayersRulesSheet). */
const RULES: Array<[string, string]> = [
  ['Pick an opponent', 'They get 24 hours to accept. Send it on WhatsApp too, in case they miss the notification.'],
  ['Same card, both of you', 'The challenger goes first on every card, then the other player gets the same card.'],
  ['Ten seconds', 'Swipe the card or tap a club. If the timer hits zero, that counts as a miss.'],
  ['One miss and it’s over', 'Both right: next card. One wrong: the other player wins the round. Both wrong: a draw.'],
  ['Best of three', 'Level after three rounds? Sudden death, until one of you gets it right and the other doesn’t.'],
  ['Don’t keep them waiting', 'Take more than 24 hours over a turn and you lose the Shootout.'],
];

export default function ShootoutRulesSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTokens();
  const ref = React.useRef<BottomSheetModal>(null);

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
      // Sized to the rules, so they all show without scrolling.
      enableDynamicSizing
      enablePanDownToClose
      onDismiss={onClose}
      backgroundStyle={{ backgroundColor: t.color.surface }}
      handleIndicatorStyle={{ backgroundColor: t.color.border }}
      backdropComponent={(props) => (
        <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.35} pressBehavior="close" />
      )}
    >
      <BottomSheetView style={{ paddingHorizontal: 18, paddingTop: 8, paddingBottom: 36 }}>
        <TotlText style={{ fontFamily: 'Gramatika-Medium', fontSize: 22, lineHeight: 26, color: t.color.text }}>
          Shootout — Rules
        </TotlText>

        <View style={{ height: 14 }} />

        {RULES.map(([title, body]) => (
          <RuleBlock key={title} title={title} body={body} />
        ))}

        <View style={{ height: 10 }} />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Got it"
          onPress={onClose}
          style={({ pressed }) => ({
            height: 54,
            borderRadius: 14,
            backgroundColor: PLAYERS_COLORS.brand,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.92 : 1,
          })}
        >
          <TotlText style={{ color: PLAYERS_COLORS.white, fontWeight: '900' }}>Got it</TotlText>
        </Pressable>
      </BottomSheetView>
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
