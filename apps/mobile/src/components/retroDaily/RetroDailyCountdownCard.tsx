import React from 'react';
import { View } from 'react-native';
import { Card, TotlText } from '@totl/ui';
import { RETRO_PIXEL_FONT } from '../../lib/retroDaily/retroFont';
import RetroDailyTotlPattern from './RetroDailyTotlPattern';

/**
 * Pre-flip countdown face (3 → 2 → 1) after swipe to start.
 */
export default function RetroDailyCountdownCard({ value }: { value: number }) {
  return (
    <Card
      style={{
        flex: 1,
        borderRadius: 28,
        borderWidth: 0,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0F766E',
        shadowOpacity: 0,
        elevation: 0,
      }}
    >
      <RetroDailyTotlPattern />
      <TotlText
        style={{
          fontFamily: RETRO_PIXEL_FONT,
          fontSize: 72,
          lineHeight: 88,
          color: '#FFFFFF',
          textAlign: 'center',
          zIndex: 1,
        }}
      >
        {value}
      </TotlText>
      <View style={{ height: 12 }} />
      <TotlText
        style={{
          fontFamily: RETRO_PIXEL_FONT,
          fontSize: 10,
          lineHeight: 16,
          color: 'rgba(255,255,255,0.85)',
          textAlign: 'center',
          zIndex: 1,
        }}
      >
        Get ready
      </TotlText>
    </Card>
  );
}
