import React from 'react';
import { Image, View } from 'react-native';
import { Card, TotlText } from '@totl/ui';
import { TEAM_BADGES } from '../../lib/teamBadges';
import { normalizeTeamCode } from '../../lib/teamColors';
import type { PlayersCard, PlayersClubOption } from '../../lib/retroPlayers/buildPuzzle';
import { RETRO_PIXEL_FONT } from '../../lib/retroDaily/retroFont';

/** How long a correct answer stays up before the next card. */
export const PLAYERS_RESULT_HOLD_MS = 900;

export type PlayersRoundOutcome = {
  card: PlayersCard;
  pick: PlayersClubOption | null;
  correct: boolean;
  timedOut: boolean;
};

function ResultFace({
  card,
  correct,
  timedOut,
  swipeHint,
}: {
  card: PlayersCard;
  correct: boolean;
  timedOut: boolean;
  swipeHint: boolean;
}) {
  const statusBg = correct ? '#1C8376' : '#DC2626';
  const statusLabel = timedOut ? 'TOO SLOW!' : correct ? 'CORRECT' : 'INCORRECT';
  const badge = TEAM_BADGES[normalizeTeamCode(card.correct.clubCode)] ?? null;

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
        <View
          style={{
            paddingHorizontal: 16,
            paddingVertical: 6,
            borderRadius: 999,
            backgroundColor: statusBg,
          }}
        >
          <TotlText
            style={{
              color: '#FFFFFF',
              fontWeight: '900',
              fontSize: 12,
              letterSpacing: 0.6,
              textTransform: 'uppercase',
            }}
          >
            {statusLabel}
          </TotlText>
        </View>
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
          {badge ? <Image source={badge} style={{ width: 80, height: 80 }} resizeMode="contain" /> : null}
        </View>
        <TotlText
          style={{
            marginTop: 12,
            fontSize: 16,
            fontWeight: '800',
            color: '#1E293B',
            textAlign: 'center',
          }}
        >
          {card.correct.clubName}
        </TotlText>
        {card.yearsAtClub ? (
          <TotlText
            style={{
              marginTop: 4,
              fontFamily: RETRO_PIXEL_FONT,
              fontSize: 10,
              lineHeight: 16,
              color: '#334155',
              textAlign: 'center',
            }}
          >
            {card.yearsAtClub}
          </TotlText>
        ) : null}
        <TotlText
          style={{
            marginTop: 4,
            fontSize: 14,
            fontWeight: '700',
            color: '#64748B',
            textAlign: 'center',
          }}
        >
          {card.appearances} Premier League appearance{card.appearances === 1 ? '' : 's'}
        </TotlText>
      </View>
      <View style={{ alignItems: 'center', justifyContent: 'center', minHeight: 24 }}>
        {swipeHint ? (
          <TotlText style={{ fontSize: 14, fontWeight: '800', color: '#64748B' }}>
            Swipe for your score
          </TotlText>
        ) : null}
      </View>
    </Card>
  );
}

export default function RetroPlayersRevealCard({
  card,
  correct,
  timedOut,
  flipKey,
  autoContinue,
  swipeReady,
  onAutoAdvance,
  instant = false,
}: {
  card: PlayersCard;
  correct: boolean;
  timedOut: boolean;
  flipKey: number;
  autoContinue: boolean;
  swipeReady: boolean;
  onAutoAdvance: () => void;
  instant?: boolean;
}) {
  const onAutoAdvanceRef = React.useRef(onAutoAdvance);
  onAutoAdvanceRef.current = onAutoAdvance;

  React.useEffect(() => {
    if (instant || !autoContinue) return;
    const id = setTimeout(() => onAutoAdvanceRef.current(), PLAYERS_RESULT_HOLD_MS);
    return () => clearTimeout(id);
  }, [autoContinue, flipKey, instant]);

  return (
    <View style={{ flex: 1 }}>
      <ResultFace
        card={card}
        correct={correct}
        timedOut={timedOut}
        swipeHint={!instant && !autoContinue && swipeReady}
      />
    </View>
  );
}
