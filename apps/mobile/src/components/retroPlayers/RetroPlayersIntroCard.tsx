import React from 'react';
import { View } from 'react-native';
import { Card, TotlText } from '@totl/ui';
import { RETRO_PIXEL_FONT } from '../../lib/retroDaily/retroFont';
import WinnerShimmer from '../WinnerShimmer';
import RetroDailyTotlPattern from '../retroDaily/RetroDailyTotlPattern';

/** Intro face for The Players. A played day waits for the next 3pm. Practice does not score. */
export default function RetroPlayersIntroCard({
  practice = false,
  played = false,
  nextGame = '',
}: {
  practice?: boolean;
  played?: boolean;
  nextGame?: string;
}) {
  return (
    <Card
      style={{
        flex: 1,
        padding: 0,
        borderRadius: 28,
        borderWidth: 0,
        overflow: 'hidden',
        shadowOpacity: 0,
        elevation: 0,
        backgroundColor: '#0F766E',
      }}
    >
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 28,
          backgroundColor: '#0F766E',
        }}
      >
        <RetroDailyTotlPattern />
        <WinnerShimmer
          durationMs={1300}
          delayMs={4200}
          opacity={0.38}
          tint="white"
          skipFirstDelay
        />
        <TotlText
          style={{
            fontSize: 13,
            fontWeight: '700',
            letterSpacing: 1.2,
            color: 'rgba(255,255,255,0.75)',
            textTransform: 'uppercase',
            textAlign: 'center',
            zIndex: 1,
          }}
        >
          {played ? 'The Players' : practice ? 'Practice mode' : 'Retro Totl Daily'}
        </TotlText>
        <TotlText
          style={{
            marginTop: 20,
            fontFamily: RETRO_PIXEL_FONT,
            fontSize: played ? 16 : 28,
            lineHeight: played ? 24 : 38,
            color: '#FFFFFF',
            textAlign: 'center',
            zIndex: 1,
          }}
        >
          {played ? "Today's game\nhas been played" : practice ? 'PRACTICE MODE' : 'The Players'}
        </TotlText>
        <TotlText
          style={{
            marginTop: 16,
            fontFamily: practice || played ? undefined : RETRO_PIXEL_FONT,
            fontSize: practice || played ? 16 : 12,
            lineHeight: practice || played ? 22 : 20,
            fontWeight: practice || played ? '800' : undefined,
            color: 'rgba(255,255,255,0.9)',
            textAlign: 'center',
            zIndex: 1,
          }}
        >
          {played ? nextGame : practice ? 'These scores will not count.' : 'Ten Players...\nWhich Ten Clubs?'}
        </TotlText>
        {played ? null : (
        <TotlText
          style={{
            marginTop: 32,
            fontSize: 15,
            lineHeight: 20,
            fontWeight: '800',
            color: '#FFFFFF',
            textAlign: 'center',
            zIndex: 1,
          }}
        >
          Swipe or tap Start
        </TotlText>
        )}
      </View>
    </Card>
  );
}
