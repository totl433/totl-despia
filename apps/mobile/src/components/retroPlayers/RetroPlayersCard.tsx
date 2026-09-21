import React from 'react';
import { View } from 'react-native';
import { Card, TotlText } from '@totl/ui';
import type { PlayersCard } from '../../lib/retroPlayers/buildPuzzle';
import { RETRO_PIXEL_FONT } from '../../lib/retroDaily/retroFont';

/**
 * Front face — player + one season clue (e.g. 96/97). Club answers sit below.
 */
export default function RetroPlayersCard({ card }: { card: PlayersCard }) {
  return (
    <Card
      style={{
        flex: 1,
        borderRadius: 28,
        borderWidth: 0,
        overflow: 'hidden',
        backgroundColor: '#FFFFFF',
        padding: 20,
        shadowOpacity: 0,
        elevation: 0,
      }}
    >
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <TotlText
          style={{
            fontSize: 11,
            fontWeight: '700',
            letterSpacing: 1.2,
            color: '#94A3B8',
            textTransform: 'uppercase',
            textAlign: 'center',
          }}
        >
          Card {card.index + 1}/10
        </TotlText>
        <TotlText
          style={{
            marginTop: 20,
            fontSize: 18,
            fontWeight: '900',
            color: '#0F172A',
            textAlign: 'center',
          }}
        >
          {card.playerName}
        </TotlText>
        <View style={{ marginTop: 16, height: 80, width: 80, alignItems: 'center', justifyContent: 'center' }}>
          <TotlText
            style={{
              fontFamily: RETRO_PIXEL_FONT,
              fontSize: 42,
              lineHeight: 48,
              color: '#0F172A',
            }}
          >
            ?
          </TotlText>
        </View>
        {card.questionSeason ? (
          <TotlText
            style={{
              marginTop: 12,
              fontFamily: RETRO_PIXEL_FONT,
              fontSize: 16,
              lineHeight: 22,
              color: '#0F172A',
              textAlign: 'center',
            }}
          >
            {card.questionSeason}
          </TotlText>
        ) : null}
        <TotlText
          style={{
            marginTop: 8,
            fontSize: 14,
            fontWeight: '800',
            color: '#64748B',
            textAlign: 'center',
          }}
        >
          Which club that season?
        </TotlText>
      </View>
    </Card>
  );
}
