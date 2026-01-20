import React from 'react';
import { Modal, Pressable, View } from 'react-native';
import { Card, TotlText, useTokens } from '@totl/ui';

export default function LeagueRulesSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
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
              Weekly Winner
            </TotlText>

            <TotlText style={{ marginBottom: 12 }}>
              🏆 How to Win the Week{'\n'}
              {'\n'}
              The player with the most correct predictions wins.
            </TotlText>

            <TotlText>
              🦄 Unicorns{'\n'}
              {'\n'}
              In Mini-Leagues with 3 or more players, if you're the only person to correctly predict a fixture, that's a
              Unicorn. In ties, the player with most Unicorns wins!
            </TotlText>

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

