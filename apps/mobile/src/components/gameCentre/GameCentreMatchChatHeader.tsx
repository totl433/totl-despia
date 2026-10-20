import React from 'react';
import { Image, View } from 'react-native';
import { TotlText, useTokens } from '@totl/ui';

import { getTeamBadgeSource } from '../../lib/teamBadges';

/** Figma 310:33274 (chat header for a game). */
const INK = { primary: '#000000', meta: 'rgba(0,0,0,0.4)' };
const BADGE = 64;

export type MatchChatSide = { name: string; code: string | null; crest?: string | null };

function Side({ side }: { side: MatchChatSide }) {
  const badge = getTeamBadgeSource(side.code, side.crest);
  return (
    <View style={{ flex: 1, paddingVertical: 16, alignItems: 'center', gap: 12 }}>
      {badge ? (
        <Image source={badge} style={{ width: BADGE, height: BADGE }} resizeMode="contain" />
      ) : (
        <View style={{ width: BADGE, height: BADGE }} />
      )}
      <View style={{ padding: 4 }}>
        <TotlText numberOfLines={1} style={{ fontFamily: 'Gramatika-Regular', fontSize: 14, lineHeight: 17, letterSpacing: 0.14, color: INK.primary, textAlign: 'center' }}>
          {side.name}
        </TotlText>
      </View>
    </View>
  );
}

/**
 * The match a fixture thread belongs to: both clubs, the kickoff time (or the score once
 * it's under way) between them, then the competition and the date and ground below.
 */
export default function GameCentreMatchChatHeader({
  home,
  away,
  centre,
  competition,
  dateVenue,
}: {
  home: MatchChatSide;
  away: MatchChatSide;
  /** "20:00" before kickoff, "3 - 1" after. */
  centre: string;
  competition: string | null;
  dateVenue: string | null;
}) {
  const t = useTokens();
  // Figma trims these lines to the letters (8pt between, 12pt below the card); a 10pt line
  // box needs 5pt and 10pt to land the same.
  const meta = { fontFamily: 'Gramatika-Regular', fontSize: 10, lineHeight: 10, letterSpacing: 0.1, color: INK.meta, textAlign: 'center' as const, includeFontPadding: false };
  return (
    <View style={{ gap: 10, alignItems: 'center' }}>
      <View style={{ alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', borderRadius: 16, backgroundColor: t.color.surface }}>
        <Side side={home} />
        <View style={{ padding: 4 }}>
          <TotlText style={{ fontFamily: 'Gramatika-Bold', fontSize: 14, lineHeight: 17, letterSpacing: 0.14, color: INK.primary, textAlign: 'center' }}>
            {centre}
          </TotlText>
        </View>
        <Side side={away} />
      </View>
      {competition || dateVenue ? (
        <View style={{ gap: 5, alignItems: 'center', maxWidth: 280 }}>
          {competition ? <TotlText style={meta}>{competition}</TotlText> : null}
          {dateVenue ? <TotlText style={meta}>{dateVenue}</TotlText> : null}
        </View>
      ) : null}
    </View>
  );
}
