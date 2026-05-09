import React from 'react';
import { View } from 'react-native';
import { Card, TotlText, useTokens } from '@totl/ui';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

/**
 * Short explainer for the green “submitted” corner badge on Mini League list avatars.
 */
export default function MiniLeaguesSubmissionLegend({ gameweek }: { gameweek: number }) {
  const t = useTokens();

  return (
    <Card
      style={{
        paddingVertical: 10,
        paddingHorizontal: 14,
        shadowOpacity: 0,
        shadowRadius: 0,
        shadowOffset: { width: 0, height: 0 },
        elevation: 0,
        borderWidth: 1,
        borderColor: 'rgba(148,163,184,0.16)',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
        <View
          style={{
            marginTop: 1,
            width: 17,
            height: 17,
            borderRadius: 8.5,
            backgroundColor: t.color.success,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <MaterialIcons name="check" size={12} color="#FFFFFF" />
        </View>

        <TotlText variant="muted" style={{ flex: 1, fontSize: 12, lineHeight: 17 }}>
          Submitted for Gameweek {gameweek}. In Predictions you can compare everyone side by side once each person in your mini
          league has submitted.
        </TotlText>
      </View>
    </Card>
  );
}
