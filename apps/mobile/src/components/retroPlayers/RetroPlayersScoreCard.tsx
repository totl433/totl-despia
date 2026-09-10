import React from 'react';
import { Image, View } from 'react-native';
import { Card, TotlText } from '@totl/ui';
import type { PlayersCard } from '../../lib/retroPlayers/buildPuzzle';
import { RETRO_PIXEL_FONT } from '../../lib/retroDaily/retroFont';
import { TEAM_BADGES } from '../../lib/teamBadges';
import { normalizeTeamCode } from '../../lib/teamColors';
import type { PlayersRoundOutcome } from './RetroPlayersRevealCard';

export function playersScoreBlurb(score: number, _total: number, perfect: boolean): string {
  if (perfect) return 'Perfect run — every club nailed.';
  if (score === 0) return 'Tough start. Have another go.';
  if (score <= 3) return 'A few legends spotted. Keep digging.';
  if (score <= 6) return 'Solid recall — the short stints bite.';
  return 'Nearly there — one more for glory.';
}

/** End-of-run sheet for The Players. */
export default function RetroPlayersScoreCard({
  cards,
  outcomes,
  score,
  perfect,
}: {
  cards: PlayersCard[];
  outcomes: PlayersRoundOutcome[];
  score: number;
  perfect: boolean;
}) {
  const byId = React.useMemo(() => {
    const map = new Map<string, PlayersRoundOutcome>();
    for (const o of outcomes) map.set(o.card.id, o);
    return map;
  }, [outcomes]);

  return (
    <Card
      style={{
        flex: 1,
        borderRadius: 28,
        borderWidth: 0,
        overflow: 'hidden',
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 12,
        paddingTop: 10,
        paddingBottom: 8,
        shadowOpacity: 0,
        elevation: 0,
      }}
    >
      <View style={{ alignItems: 'center' }}>
        <TotlText
          style={{
            fontSize: 11,
            fontWeight: '700',
            letterSpacing: 1.2,
            color: '#94A3B8',
            textTransform: 'uppercase',
          }}
        >
          Your score
        </TotlText>
        <TotlText
          style={{
            marginTop: 4,
            fontFamily: RETRO_PIXEL_FONT,
            fontSize: 22,
            lineHeight: 30,
            color: '#0F172A',
          }}
        >
          {score}/{cards.length}
        </TotlText>
        {perfect ? (
          <TotlText style={{ marginTop: 4, fontSize: 12, fontWeight: '800', color: '#1C8376' }}>
            PERFECT
          </TotlText>
        ) : null}
      </View>

      <View style={{ marginTop: 12, flex: 1, justifyContent: 'space-evenly' }}>
        {cards.map((card, i) => {
          const o = byId.get(card.id);
          const muted = !o;
          const badge = TEAM_BADGES[normalizeTeamCode(card.correct.clubCode)] ?? null;
          return (
            <View
              key={card.id}
              style={{
                flex: 1,
                minHeight: 0,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                paddingHorizontal: 4,
                backgroundColor: i % 2 === 0 ? 'rgba(248,250,252,0.9)' : '#FFFFFF',
                opacity: muted ? 0.4 : 1,
              }}
            >
              <View style={{ width: 24, alignItems: 'center' }}>
                {o ? (
                  <TotlText
                    style={{
                      fontSize: 16,
                      fontWeight: '900',
                      color: o.correct ? '#059669' : '#DC2626',
                    }}
                  >
                    {o.correct ? '✓' : '✗'}
                  </TotlText>
                ) : (
                  <TotlText style={{ color: '#CBD5E1' }}>·</TotlText>
                )}
              </View>
              <TotlText
                style={{ flex: 1, fontSize: 14, fontWeight: '700', color: '#1E293B' }}
                numberOfLines={1}
              >
                {card.playerName}
              </TotlText>
              <TotlText
                style={{
                  width: 52,
                  textAlign: 'right',
                  fontSize: 11,
                  fontWeight: '800',
                  color: '#64748B',
                }}
                numberOfLines={1}
              >
                {card.questionSeason ?? ''}
              </TotlText>
              {badge ? (
                <Image source={badge} style={{ width: 20, height: 20 }} resizeMode="contain" />
              ) : (
                <View style={{ width: 20, height: 20 }} />
              )}
              <TotlText
                style={{
                  width: 40,
                  textAlign: 'right',
                  fontSize: 12,
                  fontWeight: '800',
                  color: '#475569',
                }}
              >
                {card.appearances}
              </TotlText>
            </View>
          );
        })}
      </View>
    </Card>
  );
}
