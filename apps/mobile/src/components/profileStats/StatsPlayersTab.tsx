import React, { type PropsWithChildren } from 'react';
import { Image, Pressable, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { TotlText, useTokens } from '@totl/ui';

import { playersDayKey } from '../../lib/retroPlayers/day';
import { loadPlayerClubApps } from '../../lib/retroPlayers/loadPlayerClubApps';
import type { PlayersScoreStore } from '../../lib/retroPlayers/scores';
import { computePlayersCareerStats, computePlayersTodayField } from '../../lib/retroPlayers/stats';
import { computePlayersInsightStats, type PlayersClubInsight } from '../../lib/retroPlayers/playersInsights';
import { TEAM_BADGES } from '../../lib/teamBadges';
import { normalizeTeamCode } from '../../lib/teamColors';
import PlayersPatternCard from '../retroPlayers/PlayersPatternCard';

function SquareRow({ children }: PropsWithChildren) {
  return <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>{children}</View>;
}

function SquareCard({
  title,
  value,
  suffix,
  detail,
  onPress,
}: {
  title: string;
  value: string;
  suffix?: string | null;
  detail?: string | null;
  onPress?: () => void;
}) {
  const body = (
    <PlayersPatternCard variant="light" layout="hug" style={{ flex: 1 }}>
      <View style={{ padding: 20 }}>
        <TotlText style={{ fontSize: 14, fontWeight: '600', color: '#475569', marginBottom: 8, lineHeight: 20 }}>
          {title}
        </TotlText>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap' }}>
          <TotlText
            style={{
              fontSize: 24,
              fontWeight: '700',
              color: '#1E293B',
              lineHeight: 32,
            }}
          >
            {value}
          </TotlText>
          {suffix ? (
            <TotlText style={{ fontSize: 14, fontWeight: '400', color: '#475569', marginLeft: 8, lineHeight: 20 }}>
              {suffix}
            </TotlText>
          ) : null}
        </View>
        {detail ? (
          <TotlText style={{ marginTop: 6, fontSize: 13, fontWeight: '400', color: '#475569', lineHeight: 18 }}>
            {detail}
          </TotlText>
        ) : null}
      </View>
    </PlayersPatternCard>
  );

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title}, ${value}${suffix ? ` ${suffix}` : ''}${detail ? `, ${detail}` : ''}`}
        onPress={onPress}
        style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.94 : 1 }]}
      >
        {body}
      </Pressable>
    );
  }

  return <View style={{ flex: 1 }}>{body}</View>;
}

function formatPlayersDay(dayKey: string): string {
  const [year, month, day] = dayKey.split('-').map(Number);
  if (!year || !month || !day) return dayKey;
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function WhiteCard({ children }: PropsWithChildren) {
  return (
    <PlayersPatternCard variant="light" layout="hug" style={{ marginBottom: 16 }}>
      <View style={{ padding: 24 }}>{children}</View>
    </PlayersPatternCard>
  );
}

function MetricCard({
  title,
  value,
  detail,
}: {
  title: string;
  value: string;
  detail?: string | null;
}) {
  return (
    <WhiteCard>
      <TotlText style={{ fontSize: 14, fontWeight: '600', color: '#475569', marginBottom: 8, lineHeight: 20 }}>
        {title}
      </TotlText>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap' }}>
        <TotlText
          style={{
            fontSize: 24,
            fontWeight: '700',
            color: '#1E293B',
            lineHeight: 32,
            paddingTop: 2,
            paddingBottom: 2,
          }}
        >
          {value}
        </TotlText>
        {detail ? (
          <TotlText style={{ fontSize: 14, fontWeight: '400', color: '#475569', marginLeft: 8, lineHeight: 20 }}>
            {detail}
          </TotlText>
        ) : null}
      </View>
    </WhiteCard>
  );
}

function ClubCard({
  title,
  club,
  accent,
}: {
  title: string;
  club: PlayersClubInsight;
  accent: string;
}) {
  const t = useTokens();
  const code = normalizeTeamCode(club.code);
  const badge = code && TEAM_BADGES[code] ? TEAM_BADGES[code] : null;
  return (
    <WhiteCard>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        {badge ? (
          <Image source={badge} style={{ width: 44, height: 44 }} resizeMode="contain" />
        ) : (
          <View style={{ width: 44, height: 44, justifyContent: 'center' }}>
            <TotlText variant="muted" style={{ fontWeight: '900', fontSize: 12 }}>
              {club.name.slice(0, 3).toUpperCase()}
            </TotlText>
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <TotlText style={{ fontSize: 14, fontWeight: '600', color: '#475569', marginBottom: 8, lineHeight: 20 }}>
            {title}
          </TotlText>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
            <TotlText style={{ fontSize: 19, fontWeight: '900', color: t.color.text, flexShrink: 1 }} numberOfLines={2}>
              {club.name}
            </TotlText>
            <TotlText style={{ fontSize: 18, fontWeight: '900', color: accent }}>{`${club.percentage.toFixed(0)}%`}</TotlText>
          </View>
          <TotlText style={{ marginTop: 4, fontSize: 13, fontWeight: '600', color: '#475569' }}>
            {`${club.correct} of ${club.seen}`}
          </TotlText>
        </View>
      </View>
    </WhiteCard>
  );
}

/**
 * The Players stats tab: quiz navy page, light football-tile cards.
 * Club / era lines only count cards you actually saw.
 */
export default function StatsPlayersTab({
  scoresByUser,
  userId,
  onPressPlay,
}: {
  scoresByUser: Record<string, PlayersScoreStore> | undefined;
  userId: string | null;
  onPressPlay: () => void;
}) {
  const todayKey = playersDayKey();
  const mine = React.useMemo(
    () => (userId && scoresByUser ? scoresByUser[userId] ?? {} : {}),
    [scoresByUser, userId]
  );
  const todayScore = mine[todayKey] ?? null;
  const career = computePlayersCareerStats(mine, todayKey);
  const field = userId ? computePlayersTodayField(scoresByUser, userId, todayKey) : null;

  const clubRowsQ = useQuery({
    queryKey: ['players-club-apps'],
    queryFn: loadPlayerClubApps,
    staleTime: Infinity,
  });
  const insights = React.useMemo(
    () => computePlayersInsightStats(mine, clubRowsQ.data),
    [clubRowsQ.data, mine]
  );

  const todayLine = todayScore ? `${todayScore.correct}/${todayScore.total}` : '—';
  const best = career.bestDay;
  const worst = career.worstDay;

  return (
    <View>
      <SquareRow>
        <SquareCard
          title="Today's score"
          value={todayLine}
          detail={todayScore ? null : 'Play today'}
          onPress={onPressPlay}
        />
        <SquareCard
          title="Streak"
          value={career.streak >= 1 ? `🔥 ${career.streak}` : '—'}
          suffix={career.streak === 1 ? 'day' : career.streak > 1 ? 'days' : null}
          detail={career.streak < 1 ? 'Play today to start one' : null}
        />
      </SquareRow>

      <SquareRow>
        <SquareCard
          title="Best day"
          value={best ? `${best.correct}/${best.total}` : '—'}
          detail={best ? formatPlayersDay(best.dayKey) : null}
        />
        <SquareCard
          title="Lowest day"
          value={worst ? `${worst.correct}/${worst.total}` : '—'}
          detail={worst ? formatPlayersDay(worst.dayKey) : null}
        />
      </SquareRow>

      {insights.know ? <ClubCard title="Club you know" club={insights.know} accent="#059669" /> : null}

      {insights.fool && insights.fool.code !== insights.know?.code ? (
        <ClubCard title="Club that fools you" club={insights.fool} accent="#DC2626" />
      ) : null}

      {insights.eras.length > 0 ? (
        <WhiteCard>
          <TotlText style={{ fontSize: 14, fontWeight: '600', color: '#475569', marginBottom: 8, lineHeight: 20 }}>
            Era
          </TotlText>
          <View style={{ gap: 10 }}>
            {insights.eras.map((era) => (
              <View key={era.key} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                <TotlText style={{ fontSize: 18, fontWeight: '700', color: '#1E293B', lineHeight: 24 }}>{era.label}</TotlText>
                <TotlText style={{ fontSize: 18, fontWeight: '700', color: '#1E293B', lineHeight: 24 }}>
                  {`${era.correct}/${era.seen}`}
                </TotlText>
              </View>
            ))}
          </View>
        </WhiteCard>
      ) : null}

      {field ? (
        <WhiteCard>
          <TotlText style={{ fontSize: 14, fontWeight: '600', color: '#475569', marginBottom: 8, lineHeight: 20 }}>
            Today vs the field
          </TotlText>
          <TotlText style={{ fontSize: 24, fontWeight: '700', color: '#1E293B', lineHeight: 32 }}>
            {field.players === 1 ? "You're first in" : `You're in the top ${field.topPct}%`}
          </TotlText>
          <TotlText style={{ marginTop: 8, fontSize: 13, lineHeight: 18, fontWeight: '600', color: '#475569' }}>
            {field.players === 1
              ? 'No one else has a score yet today.'
              : `You beat ${Math.round(field.beatPct)}% of players · field average ${field.average.toFixed(1)}`}
          </TotlText>
        </WhiteCard>
      ) : null}

      <MetricCard
        title="Perfects"
        value={String(career.perfects)}
        detail={career.perfects === 1 ? '10/10 day' : '10/10 days'}
      />
    </View>
  );
}
