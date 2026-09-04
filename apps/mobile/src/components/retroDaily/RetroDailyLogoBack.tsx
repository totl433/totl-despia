import React from 'react';
import { Card, TotlText } from '@totl/ui';
import { RETRO_PIXEL_FONT } from '../../lib/retroDaily/retroFont';
import { MOCK_RETRO_SEASON_FULL } from '../../lib/retroDaily/mockPuzzle';
import RetroDailyTotlPattern from './RetroDailyTotlPattern';

/** Stack peek / pre-flip face — season year over a TOTL logo pattern. */
export default function RetroDailyLogoBack({
  seasonLabel = MOCK_RETRO_SEASON_FULL,
}: {
  seasonLabel?: string;
}) {
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
        paddingHorizontal: 20,
      }}
    >
      <RetroDailyTotlPattern />
      <TotlText
        style={{
          fontFamily: RETRO_PIXEL_FONT,
          fontSize: 28,
          lineHeight: 40,
          color: '#FFFFFF',
          textAlign: 'center',
          zIndex: 1,
        }}
      >
        {seasonLabel}
      </TotlText>
    </Card>
  );
}
