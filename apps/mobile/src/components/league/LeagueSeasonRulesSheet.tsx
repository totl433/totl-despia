import React from 'react';
import { Modal, Pressable, View } from 'react-native';
import { Card, TotlText, useTokens } from '@totl/ui';

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

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: 'rgba(2, 6, 23, 0.62)',
          padding: t.space[4],
          justifyContent: 'center',
        }}
      >
        <Pressable onPress={() => {}} style={{ width: '100%' }}>
          <Card style={{ padding: t.space[4] }}>
            <TotlText variant="heading" style={{ marginBottom: 10 }}>
              League Points
            </TotlText>

            <TotlText style={{ marginBottom: 12 }}>
              Win the week – 3 points{'\n'}
              Draw – 1 point{'\n'}
              Lose – 0 points
            </TotlText>

            <TotlText style={{ marginBottom: 12 }}>
              🤝 Ties{'\n'}
              {'\n'}
              If two or more players are tied on Points in the table, the player with the most overall Unicorns in the mini
              league is ranked higher.
            </TotlText>

            {isLateStartingLeague ? (
              <TotlText variant="muted">Note: This mini league started after GW1, so CP shows correct predictions since it began.</TotlText>
            ) : null}

            <View style={{ height: 14 }} />
            <Pressable
              onPress={onClose}
              style={({ pressed }) => ({
                alignSelf: 'flex-end',
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderRadius: 999,
                backgroundColor: t.color.brand,
                opacity: pressed ? 0.92 : 1,
              })}
            >
              <TotlText style={{ color: '#FFFFFF', fontWeight: '900' }}>Done</TotlText>
            </Pressable>
          </Card>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

