import React from 'react';
import { Image, View } from 'react-native';
import { Card, TotlText } from '@totl/ui';
import { TEAM_BADGES } from '../../lib/teamBadges';
import { normalizeTeamCode } from '../../lib/teamColors';
import type { PlayersCard, PlayersClubOption } from '../../lib/retroPlayers/buildPuzzle';
import { RETRO_PIXEL_FONT } from '../../lib/retroDaily/retroFont';
import RetroDailyFlip from '../retroDaily/RetroDailyFlip';
import RetroDailyTotlPattern from '../retroDaily/RetroDailyTotlPattern';

export const PLAYERS_REVEAL_HOLD_MS = 2000;
export const PLAYERS_REVEAL_FLIP_MS = 420;
export const PLAYERS_REVEAL_NEXT_BEAT_MS = 900;

export type PlayersRoundOutcome = {
  card: PlayersCard;
  pick: PlayersClubOption | null;
  correct: boolean;
  timedOut: boolean;
};

function LoadingFace() {
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
        paddingHorizontal: 24,
      }}
    >
      <RetroDailyTotlPattern />
      <TotlText
        style={{
          fontFamily: RETRO_PIXEL_FONT,
          fontSize: 11,
          lineHeight: 18,
          color: '#FFFFFF',
          textAlign: 'center',
          zIndex: 1,
        }}
      >
        Checking…
      </TotlText>
    </Card>
  );
}

function ResultFace({
  card,
  correct,
  timedOut,
  nextCountdown,
  swipeHint,
}: {
  card: PlayersCard;
  correct: boolean;
  timedOut: boolean;
  nextCountdown: number | null;
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
        {nextCountdown != null ? (
          <TotlText style={{ fontSize: 14, fontWeight: '800', color: '#64748B' }}>
            Next in {nextCountdown}…
          </TotlText>
        ) : null}
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
  const [showResult, setShowResult] = React.useState(instant);
  const [nextCountdown, setNextCountdown] = React.useState<number | null>(null);
  const onAutoAdvanceRef = React.useRef(onAutoAdvance);
  onAutoAdvanceRef.current = onAutoAdvance;

  React.useEffect(() => {
    if (instant) {
      setShowResult(true);
      setNextCountdown(null);
      return;
    }
    setShowResult(false);
    setNextCountdown(null);
    const id = setTimeout(() => setShowResult(true), PLAYERS_REVEAL_HOLD_MS);
    return () => clearTimeout(id);
  }, [flipKey, instant]);

  React.useEffect(() => {
    if (instant || !showResult || !autoContinue) return;
    const start = PLAYERS_REVEAL_FLIP_MS + 80;
    const a = setTimeout(() => setNextCountdown(3), start);
    const b = setTimeout(() => setNextCountdown(2), start + PLAYERS_REVEAL_NEXT_BEAT_MS);
    const c = setTimeout(() => setNextCountdown(1), start + PLAYERS_REVEAL_NEXT_BEAT_MS * 2);
    const d = setTimeout(() => onAutoAdvanceRef.current(), start + PLAYERS_REVEAL_NEXT_BEAT_MS * 3);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
      clearTimeout(c);
      clearTimeout(d);
    };
  }, [autoContinue, instant, showResult, flipKey]);

  if (instant) {
    return (
      <View style={{ flex: 1 }}>
        <ResultFace
          card={card}
          correct={correct}
          timedOut={timedOut}
          nextCountdown={null}
          swipeHint={false}
        />
      </View>
    );
  }

  return (
    <RetroDailyFlip
      resetKey={flipKey}
      durationMs={PLAYERS_REVEAL_FLIP_MS}
      showB={showResult}
      faceA={<LoadingFace />}
      faceB={
        <ResultFace
          card={card}
          correct={correct}
          timedOut={timedOut}
          nextCountdown={autoContinue ? nextCountdown : null}
          swipeHint={!autoContinue && swipeReady}
        />
      }
    />
  );
}
