import React from 'react';
import { Image, Pressable, Share, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Card, TotlText, useTokens } from '@totl/ui';
import {
  pickLabel,
  type RetroFixture,
  type RetroPick,
} from '../../lib/retroDaily/mockPuzzle';
import { RETRO_PIXEL_FONT } from '../../lib/retroDaily/retroFont';
import { TEAM_BADGES } from '../../lib/teamBadges';
import { normalizeTeamCode } from '../../lib/teamColors';

export type RetroRoundOutcome = {
  fixture: RetroFixture;
  pick: RetroPick | null;
  correct: boolean;
  timedOut: boolean;
};

function TeamBadge({ code, size = 18, muted = false }: { code: string; size?: number; muted?: boolean }) {
  const badge = TEAM_BADGES[normalizeTeamCode(code)] ?? null;
  if (!badge) {
    return (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: muted ? '#F1F5F9' : '#E2E8F0',
          opacity: muted ? 0.5 : 1,
        }}
      />
    );
  }
  return (
    <Image source={badge} style={{ width: size, height: size, opacity: muted ? 0.35 : 1 }} resizeMode="contain" />
  );
}

/**
 * Final score card — compact header + all 10 fixtures (unreached greyed out).
 */
export default function RetroDailyScoreCard({
  seasonLabel,
  fixtures,
  outcomes,
  score,
  perfect,
  onShare,
}: {
  seasonLabel: string;
  fixtures: RetroFixture[];
  outcomes: RetroRoundOutcome[];
  score: number;
  perfect: boolean;
  onShare?: () => void;
}) {
  const t = useTokens();
  const total = fixtures.length;
  const byId = React.useMemo(() => {
    const map = new Map<string, RetroRoundOutcome>();
    for (const o of outcomes) map.set(o.fixture.id, o);
    return map;
  }, [outcomes]);

  const handleShare = React.useCallback(async () => {
    if (onShare) {
      onShare();
      return;
    }
    const lines = [
      `Retro Totl Daily · ${seasonLabel}`,
      `I got ${score}/${total}`,
      '',
      ...outcomes.map((o) => {
        const mark = o.correct ? '✓' : '✗';
        return `${mark} ${o.fixture.homeName} ${o.fixture.homeScore}-${o.fixture.awayScore} ${o.fixture.awayName}`;
      }),
    ];
    try {
      await Share.share({ message: lines.join('\n') });
    } catch {
      // ignore
    }
  }, [onShare, outcomes, score, seasonLabel, total]);

  const blurb = perfect
    ? 'Perfect ten — absolute scenes.'
    : score === 0
      ? 'Rough start — tomorrow’s another season.'
      : 'Solid run. Come back for tomorrow’s ten.';

  return (
    <Card
      style={{
        flex: 1,
        borderRadius: 28,
        borderWidth: 0,
        overflow: 'hidden',
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 14,
        paddingTop: 12,
        paddingBottom: 10,
        shadowOpacity: 0,
        elevation: 0,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
            <TotlText
              style={{
                fontFamily: RETRO_PIXEL_FONT,
                fontSize: 22,
                lineHeight: 30,
                color: t.color.text,
                includeFontPadding: false,
              }}
            >
              {score}/{total}
            </TotlText>
            <TotlText
              style={{
                fontFamily: RETRO_PIXEL_FONT,
                fontSize: 10,
                lineHeight: 14,
                color: '#0F766E',
              }}
            >
              {seasonLabel}
            </TotlText>
          </View>
          <TotlText
            style={{ marginTop: 2, fontSize: 11, fontWeight: '700', color: '#64748B' }}
            numberOfLines={1}
          >
            Retro Totl Daily · {blurb}
          </TotlText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Share score"
          onPress={() => void handleShare()}
          style={({ pressed }) => ({
            width: 34,
            height: 34,
            borderRadius: 17,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#E2E8F0',
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Ionicons name="share-outline" size={18} color="#0F172A" />
        </Pressable>
      </View>

      <View style={{ marginTop: 8, flex: 1, justifyContent: 'space-between' }}>
        {fixtures.map((fixture) => {
          const o = byId.get(fixture.id);
          const locked = !o;
          const muted = locked;
          const nameColor = muted ? '#94A3B8' : t.color.text;
          const scoreColor = muted ? '#CBD5E1' : t.color.text;

          return (
            <View
              key={fixture.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                flex: 1,
                minHeight: 28,
                maxHeight: 36,
                borderTopWidth: 1,
                borderTopColor: '#F1F5F9',
                gap: 6,
                opacity: muted ? 0.55 : 1,
              }}
            >
              <TotlText
                style={{
                  width: 14,
                  fontWeight: '900',
                  fontSize: 12,
                  textAlign: 'center',
                  color: locked ? '#CBD5E1' : o.correct ? '#1C8376' : '#DC2626',
                }}
              >
                {locked ? '·' : o.correct ? '✓' : '✗'}
              </TotlText>

              <TeamBadge code={fixture.homeCode} muted={muted} />

              <TotlText
                style={{ flex: 1, fontWeight: '700', fontSize: 11, color: nameColor, textAlign: 'right' }}
                numberOfLines={1}
              >
                {fixture.homeName}
              </TotlText>

              <TotlText
                style={{
                  fontWeight: '900',
                  fontSize: 12,
                  color: scoreColor,
                  minWidth: 34,
                  textAlign: 'center',
                }}
              >
                {locked ? '–' : `${o.fixture.homeScore}–${o.fixture.awayScore}`}
              </TotlText>

              <TotlText
                style={{ flex: 1, fontWeight: '700', fontSize: 11, color: nameColor, textAlign: 'left' }}
                numberOfLines={1}
              >
                {fixture.awayName}
              </TotlText>

              <TeamBadge code={fixture.awayCode} muted={muted} />
            </View>
          );
        })}
      </View>

      {outcomes.some((o) => !o.correct) ? (
        <TotlText
          style={{
            marginTop: 6,
            fontSize: 11,
            fontWeight: '600',
            color: '#94A3B8',
            textAlign: 'center',
          }}
          numberOfLines={1}
        >
          {(() => {
            const miss = [...outcomes].reverse().find((o) => !o.correct);
            if (!miss) return ' ';
            if (miss.timedOut) return 'Last miss: too slow';
            return `Last miss: you picked ${miss.pick ? pickLabel(miss.pick) : '—'}`;
          })()}
        </TotlText>
      ) : (
        <View style={{ height: 4 }} />
      )}
    </Card>
  );
}
