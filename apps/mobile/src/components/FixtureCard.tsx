import React from 'react';
import { Image, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Card, TotlText, useTokens } from '@totl/ui';
import WinnerShimmer from './WinnerShimmer';
import { TEAM_BADGES } from '../lib/teamBadges';
import { areTeamNamesSimilar, getMediumName } from '../../../../src/lib/teamNames';

export type Pick = 'H' | 'D' | 'A';
export type LiveStatus = 'TIMED' | 'IN_PLAY' | 'PAUSED' | 'FINISHED' | 'SCHEDULED';

export type FixtureLike = {
  id: string;
  fixture_index: number;
  kickoff_time?: string | null;
  home_code?: string | null;
  away_code?: string | null;
  home_team?: string | null;
  away_team?: string | null;
  home_name?: string | null;
  away_name?: string | null;
};

export type LiveScoreLike = {
  status?: LiveStatus | string | null;
  minute?: number | null;
  home_score?: number | null;
  away_score?: number | null;
  goals?: unknown;
};

type GoalEvent = { team?: string | null; scorer?: string | null; minute?: number | null; isOwnGoal?: boolean | null };

function formatMinute(status: LiveStatus, minute: number | null | undefined) {
  if (status === 'FINISHED') return 'FT';
  if (status === 'PAUSED') return 'HT';
  if (status === 'IN_PLAY') return typeof minute === 'number' ? `${minute}'` : 'LIVE';
  return '';
}

function formatKickoffUtc(kickoff: string | null | undefined) {
  if (!kickoff) return '—';
  const d = new Date(kickoff);
  if (Number.isNaN(d.getTime())) return '—';
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function getSurname(fullName: string | null | undefined): string {
  if (!fullName) return 'Unknown';
  const trimmed = fullName.trim();
  if (!trimmed) return 'Unknown';
  if (trimmed.toLowerCase().includes('own goal') || trimmed.toLowerCase().includes('(og)')) return trimmed;
  const parts = trimmed.split(/\s+/);
  return parts.length ? parts[parts.length - 1] : trimmed;
}

function parseGoals(raw: unknown): GoalEvent[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((g) => (g && typeof g === 'object' ? (g as any) : null))
    .filter(Boolean)
    .map((g) => ({
      team: typeof g.team === 'string' ? g.team : null,
      scorer: typeof g.scorer === 'string' ? g.scorer : null,
      minute: typeof g.minute === 'number' ? g.minute : null,
      isOwnGoal: typeof g.isOwnGoal === 'boolean' ? g.isOwnGoal : null,
    }));
}

export default function FixtureCard({
  fixture,
  liveScore,
  pick,
  result,
  showPickButtons = true,
  variant = 'standalone',
}: {
  fixture: FixtureLike;
  liveScore?: LiveScoreLike | null;
  pick?: Pick;
  /** Optional authoritative outcome (e.g. from `app_gw_results`). */
  result?: Pick | null;
  showPickButtons?: boolean;
  /**
   * - `standalone`: renders with its own card border (good for Storybook / isolated usage)
   * - `grouped`: renders borderless, intended to sit inside a parent `Card` list
   */
  variant?: 'standalone' | 'grouped';
}) {
  const t = useTokens();
  const BADGE_SIZE = 20; // ~10% bigger than 18
  const BADGE_GAP = 10; // push badge closer to the score (between name and score)
  const SCORE_COL_WIDTH = 84; // tighter so crests sit closer to the score

  const ls = liveScore ?? null;
  const hs = Number(ls?.home_score ?? 0);
  const as = Number(ls?.away_score ?? 0);
  const st = String(ls?.status ?? 'SCHEDULED') as LiveStatus;
  const isOngoing = st === 'IN_PLAY' || st === 'PAUSED';
  const isFinished = st === 'FINISHED';
  const showScore = !!ls && (isOngoing || isFinished);

  const homeCode = String(fixture.home_code ?? '').toUpperCase();
  const awayCode = String(fixture.away_code ?? '').toUpperCase();
  const homeBadge = TEAM_BADGES[homeCode] ?? null;
  const awayBadge = TEAM_BADGES[awayCode] ?? null;

  const homeKey = String(fixture.home_team ?? fixture.home_name ?? homeCode ?? 'Home');
  const awayKey = String(fixture.away_team ?? fixture.away_name ?? awayCode ?? 'Away');
  const homeName = getMediumName(homeKey);
  const awayName = getMediumName(awayKey);

  const derivedOutcome: Pick | null = showScore ? (result ?? (hs > as ? 'H' : hs < as ? 'A' : 'D')) : null;

  const buttonStyle = (side: Pick) => {
    const isPicked = pick === side;
    const isCorrectResult = showScore ? derivedOutcome === side : false;
    const isCorrect = isPicked && isCorrectResult;
    const isWrong = isPicked && showScore && !isCorrectResult;

    if (isOngoing && isCorrect)
      return { bg: '#059669', border: 'transparent', text: '#FFFFFF', isPicked, isCorrect, isWrong, isCorrectResult, gradient: false };
    if (isFinished && isCorrect)
      return { bg: 'transparent', border: 'transparent', text: '#FFFFFF', isPicked, isCorrect, isWrong, isCorrectResult, gradient: true };
    if (isWrong) return { bg: t.color.brand, border: 'transparent', text: '#FFFFFF', isPicked, isCorrect, isWrong, isCorrectResult };
    if (isPicked) return { bg: t.color.brand, border: 'transparent', text: '#FFFFFF', isPicked, isCorrect, isWrong, isCorrectResult };
    if (showScore && isCorrectResult && !isPicked) return { bg: t.color.surface2, border: '#059669', text: t.color.text, isPicked, isCorrect, isWrong, isCorrectResult };
    return { bg: t.color.surface2, border: t.color.border, text: t.color.text, isPicked, isCorrect, isWrong, isCorrectResult };
  };

  const renderGoalsTimeline = (teamCandidates: string[], align: 'flex-start' | 'flex-end') => {
    if (!showScore) return null;
    const goals = parseGoals((ls as any)?.goals);
    if (!goals.length) return null;

    const teamGoals = goals.filter((g) => {
      const gt = String(g.team ?? '');
      if (!gt) return false;
      return teamCandidates.some((c) => areTeamNamesSimilar(gt, c) || gt.toLowerCase() === c.toLowerCase());
    });
    if (!teamGoals.length) return null;

    const byScorer = new Map<string, Array<{ minute: number; isOwnGoal: boolean }>>();
    teamGoals.forEach((g) => {
      const scorer = getSurname(g.scorer);
      const minute = typeof g.minute === 'number' ? g.minute : null;
      if (minute === null) return;
      const isOwnGoal = g.isOwnGoal === true;
      const arr = byScorer.get(scorer) ?? [];
      arr.push({ minute, isOwnGoal });
      byScorer.set(scorer, arr);
    });
    if (!byScorer.size) return null;

    const lines = Array.from(byScorer.entries()).map(([scorer, mins]) => {
      const sorted = [...mins].sort((a, b) => a.minute - b.minute);
      const minutesDisplay = sorted.map((m) => (m.isOwnGoal ? `${m.minute}' (OG)` : `${m.minute}'`)).join(', ');
      return `${scorer} ${minutesDisplay}`;
    });

    return (
      <View style={{ marginTop: 10, marginBottom: 6, alignItems: align }}>
        {lines.slice(0, 3).map((txt, idx) => (
          <TotlText key={`${txt}-${idx}`} variant="microMuted">
            {txt}
          </TotlText>
        ))}
      </View>
    );
  };

  const ButtonChip = ({ side, label }: { side: Pick; label: string }) => {
    const s = buttonStyle(side);
    const commonStyle = {
      flex: 1,
      height: 64,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: s.border,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      overflow: 'hidden' as const,
      position: 'relative' as const,
    };

    const text = (
      <TotlText
        variant="body"
        style={{
          color: s.text,
          fontWeight: s.isCorrect ? '800' : '700',
          fontSize: 14,
          textDecorationLine: s.isWrong && isFinished ? 'line-through' : 'none',
          textDecorationStyle: 'solid',
          textDecorationColor: s.text,
        }}
      >
        {label}
      </TotlText>
    );

    if ((s as any).gradient) {
      return (
        <LinearGradient
          colors={['#FACC15', '#F97316', '#EC4899', '#9333EA']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ ...commonStyle, borderWidth: 0 }}
        >
          <WinnerShimmer durationMs={1200} delayMs={0} opacity={0.95} tint="white" />
          <WinnerShimmer durationMs={1800} delayMs={380} opacity={0.55} tint="gold" />
          {text}
        </LinearGradient>
      );
    }

    return (
      <View style={{ backgroundColor: s.bg, ...commonStyle }}>
        {text}
      </View>
    );
  };

  return (
    <View>
      {variant === 'standalone' ? (
        <Card style={{ padding: 0, shadowOpacity: 0, shadowRadius: 0, shadowOffset: { width: 0, height: 0 }, elevation: 0 }}>
          <View style={{ borderRadius: 14, overflow: 'hidden' }}>
            <View style={{ paddingVertical: 14 }}>
              {/* LIVE indicator */}
              {isOngoing ? (
                <View style={{ position: 'absolute', left: 16, top: 10, flexDirection: 'row', alignItems: 'center' }}>
                  <View style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: '#EF4444', marginRight: 8 }} />
                  <TotlText variant="caption" style={{ color: '#EF4444', fontWeight: '900', letterSpacing: 0.6 }}>
                    LIVE
                  </TotlText>
                </View>
              ) : null}

              {/* Teams + score */}
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16, paddingTop: isOngoing ? 16 : 0 }}>
                {/* Home */}
                <View style={{ flex: 1, minWidth: 0, alignItems: 'flex-end', paddingRight: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%', justifyContent: 'flex-end' }}>
                    <TotlText
                      numberOfLines={1}
                      ellipsizeMode="tail"
                      style={{
                        fontWeight: hs > as && showScore ? '800' : '600',
                        flexGrow: 1,
                        flexShrink: 1,
                        textAlign: 'right',
                      }}
                    >
                      {homeName}
                    </TotlText>
                    {/* When showing a score, badges live beside the score (center cluster). */}
                    {!showScore && homeBadge ? (
                      <Image source={homeBadge} style={{ width: BADGE_SIZE, height: BADGE_SIZE, marginLeft: BADGE_GAP }} />
                    ) : null}
                  </View>
                  {renderGoalsTimeline([homeName, String(fixture.home_team ?? ''), String(fixture.home_name ?? ''), homeCode], 'flex-end')}
                </View>

                {/* Score / kickoff */}
                <View style={{ width: SCORE_COL_WIDTH, alignItems: 'center' }}>
                  {showScore ? (
                    <>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                        {homeBadge ? <Image source={homeBadge} style={{ width: BADGE_SIZE, height: BADGE_SIZE, marginRight: 8 }} /> : null}
                        <TotlText style={{ fontWeight: '900', fontSize: 16 }}>
                          {hs} - {as}
                        </TotlText>
                        {awayBadge ? <Image source={awayBadge} style={{ width: BADGE_SIZE, height: BADGE_SIZE, marginLeft: 8 }} /> : null}
                      </View>
                      {isFinished ? (
                        <TotlText variant="microMuted">{formatMinute(st, typeof ls?.minute === 'number' ? ls.minute : null)}</TotlText>
                      ) : (
                        <TotlText variant="caption" style={{ color: isOngoing ? '#DC2626' : t.color.muted, fontWeight: '800' }}>
                          {formatMinute(st, typeof ls?.minute === 'number' ? ls.minute : null)}
                        </TotlText>
                      )}
                    </>
                  ) : (
                    <TotlText variant="caption" style={{ color: t.color.muted, fontWeight: '700' }}>
                      {formatKickoffUtc(fixture.kickoff_time ?? null)}
                    </TotlText>
                  )}
                </View>

                {/* Away */}
                <View style={{ flex: 1, minWidth: 0, alignItems: 'flex-start', paddingLeft: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%', justifyContent: 'flex-start' }}>
                    {/* When showing a score, badges live beside the score (center cluster). */}
                    {!showScore && awayBadge ? (
                      <Image source={awayBadge} style={{ width: BADGE_SIZE, height: BADGE_SIZE, marginRight: BADGE_GAP }} />
                    ) : null}
                    <TotlText numberOfLines={1} ellipsizeMode="tail" style={{ fontWeight: as > hs && showScore ? '800' : '600', flexShrink: 1 }}>
                      {awayName}
                    </TotlText>
                  </View>
                  {renderGoalsTimeline([awayName, String(fixture.away_team ?? ''), String(fixture.away_name ?? ''), awayCode], 'flex-start')}
                </View>
              </View>

              {/* Picks */}
              {showPickButtons ? (
                <View style={{ flexDirection: 'row', marginTop: 12, paddingHorizontal: 16 }}>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <ButtonChip side="H" label="Home Win" />
                  </View>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <ButtonChip side="D" label="Draw" />
                  </View>
                  <ButtonChip side="A" label="Away Win" />
                </View>
              ) : null}
            </View>
          </View>
        </Card>
      ) : (
        // `grouped`: no outer card/border — parent list card handles borders & radius.
        <View style={{ paddingVertical: 14 }}>
          {/* LIVE indicator */}
          {isOngoing ? (
            <View style={{ position: 'absolute', left: 16, top: 10, flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: '#EF4444', marginRight: 8 }} />
              <TotlText variant="caption" style={{ color: '#EF4444', fontWeight: '900', letterSpacing: 0.6 }}>
                LIVE
              </TotlText>
            </View>
          ) : null}

          {/* Teams + score */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16, paddingTop: isOngoing ? 16 : 0 }}>
            {/* Home */}
            <View style={{ flex: 1, minWidth: 0, alignItems: 'flex-end', paddingRight: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%', justifyContent: 'flex-end' }}>
                <TotlText
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  style={{
                    fontWeight: hs > as && showScore ? '800' : '600',
                    flexGrow: 1,
                    flexShrink: 1,
                    textAlign: 'right',
                  }}
                >
                  {homeName}
                </TotlText>
                {!showScore && homeBadge ? (
                  <Image source={homeBadge} style={{ width: BADGE_SIZE, height: BADGE_SIZE, marginLeft: BADGE_GAP }} />
                ) : null}
              </View>
              {renderGoalsTimeline([homeName, String(fixture.home_team ?? ''), String(fixture.home_name ?? ''), homeCode], 'flex-end')}
            </View>

            {/* Score / kickoff */}
            <View style={{ width: SCORE_COL_WIDTH, alignItems: 'center' }}>
              {showScore ? (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                    {homeBadge ? <Image source={homeBadge} style={{ width: BADGE_SIZE, height: BADGE_SIZE, marginRight: 8 }} /> : null}
                    <TotlText style={{ fontWeight: '900', fontSize: 16 }}>
                      {hs} - {as}
                    </TotlText>
                    {awayBadge ? <Image source={awayBadge} style={{ width: BADGE_SIZE, height: BADGE_SIZE, marginLeft: 8 }} /> : null}
                  </View>
                  {isFinished ? (
                    <TotlText variant="microMuted">{formatMinute(st, typeof ls?.minute === 'number' ? ls.minute : null)}</TotlText>
                  ) : (
                    <TotlText variant="caption" style={{ color: isOngoing ? '#DC2626' : t.color.muted, fontWeight: '800' }}>
                      {formatMinute(st, typeof ls?.minute === 'number' ? ls.minute : null)}
                    </TotlText>
                  )}
                </>
              ) : (
                <TotlText variant="caption" style={{ color: t.color.muted, fontWeight: '700' }}>
                  {formatKickoffUtc(fixture.kickoff_time ?? null)}
                </TotlText>
              )}
            </View>

            {/* Away */}
            <View style={{ flex: 1, minWidth: 0, alignItems: 'flex-start', paddingLeft: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%', justifyContent: 'flex-start' }}>
                {!showScore && awayBadge ? (
                  <Image source={awayBadge} style={{ width: BADGE_SIZE, height: BADGE_SIZE, marginRight: BADGE_GAP }} />
                ) : null}
                <TotlText numberOfLines={1} ellipsizeMode="tail" style={{ fontWeight: as > hs && showScore ? '800' : '600', flexShrink: 1 }}>
                  {awayName}
                </TotlText>
              </View>
              {renderGoalsTimeline([awayName, String(fixture.away_team ?? ''), String(fixture.away_name ?? ''), awayCode], 'flex-start')}
            </View>
          </View>

          {/* Picks */}
          {showPickButtons ? (
            <View style={{ flexDirection: 'row', marginTop: 12, paddingHorizontal: 16 }}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <ButtonChip side="H" label="Home Win" />
              </View>
              <View style={{ flex: 1, marginRight: 12 }}>
                <ButtonChip side="D" label="Draw" />
              </View>
              <ButtonChip side="A" label="Away Win" />
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}

