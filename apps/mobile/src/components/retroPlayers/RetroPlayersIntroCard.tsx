import React from 'react';
import { View } from 'react-native';
import { Card, TotlText } from '@totl/ui';
import { RETRO_PIXEL_FONT } from '../../lib/retroDaily/retroFont';
import WinnerShimmer from '../WinnerShimmer';
import RetroDailyTotlPattern from '../retroDaily/RetroDailyTotlPattern';

/** Intro face for Retro Totl Daily — The Players. Matches web (no idle 3D wobble). */
export default function RetroPlayersIntroCard() {
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
          Retro Totl Daily
        </TotlText>
        <TotlText
          style={{
            marginTop: 20,
            fontFamily: RETRO_PIXEL_FONT,
            fontSize: 28,
            lineHeight: 38,
            color: '#FFFFFF',
            textAlign: 'center',
            zIndex: 1,
          }}
        >
          The Players
        </TotlText>
        <TotlText
          style={{
            marginTop: 16,
            fontFamily: RETRO_PIXEL_FONT,
            fontSize: 12,
            lineHeight: 20,
            color: 'rgba(255,255,255,0.9)',
            textAlign: 'center',
            zIndex: 1,
          }}
        >
          Ten Players...{'\n'}Which Ten Clubs?
        </TotlText>
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
      </View>
    </Card>
  );
}
