import type { QueryClient } from '@tanstack/react-query';
import type { Fixture, LiveScore, Pick } from '@totl/domain';

import { api } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { normalizeTeamForms } from '../../lib/homeFixtureUi';
import { getMonthForGw, type LeaderboardSeasonKey } from '../../lib/leaderboardMonths';
import { predictionsDeadlineMs } from '../../lib/gameweekState';
import { fetchTeamPositionsWithFallback, normalizeTeamPositions } from '../../lib/teamPositions';
import { fetchGameCentrePosts } from '../../hooks/useGameCentrePosts';
import { indexLiveScoresByFixture, resolveLiveScore } from '../../lib/liveScoreRows';
import { buildDerivedFeed } from './derivedFeed';
import { alignChatSortAtMs, buildMatchFeed, buildRoundUp, firstKickoffMs, type FeedItem } from './feed';
import { hereWeGoMs } from './shoutOutSlots';
import {
  fetchLeagueChat,
  fetchLeagueTables,
  fetchMemberPicks,
  fetchOverallReplay,
  fetchPickPercentRows,
  leaguePicksFrom,
  memberIdsOf,
  pickPercentsFrom,
  type FeedLeague,
  type FeedSeason,
} from './feedData';
import { compareFeedItems, gameweekOpensAtMs, isoOrNull, placeRoundUp } from './timeline';

export type PastGameweek = {
  gw: number;
  /** When this gameweek's feed opened; the next older gameweek's messages end here. */
  opensAtMs: number | null;
  fixtures: Fixture[];
  /** Built from stored posts, so its cards carry comments and any emoji. */
  social: boolean;
  items: FeedItem[];
};

const STALE_MS = 5 * 60_000;

/** A missing nicety (forms, percentages, league replays) shouldn't hold back the week. */
async function optional<T>(load: () => Promise<T>): Promise<T | null> {
  try {
    return await load();
  } catch (error) {
    console.warn('[GameCentre] older gameweek detail failed:', error);
    return null;
  }
}

/**
 * Everything the feed showed for a gameweek that has been and gone, built the same way as
 * the gameweek on top. Messages are the ones sent from when this gameweek's feed opened
 * until the next one's did (`untilMs`), so each message appears once in the timeline.
 * Reads go through the same cache keys as the screen, so a week loaded there isn't loaded twice.
 */
export async function loadPastGameweek(input: {
  queryClient: QueryClient;
  gw: number;
  untilMs: number | null;
  leagues: FeedLeague[];
  season: FeedSeason;
  seasonKey: LeaderboardSeasonKey;
  userId: string | null;
  userAvatar: string | null;
  postsOn: boolean;
}): Promise<PastGameweek> {
  const { queryClient, gw, leagues, season, userId } = input;
  const seasonCacheKey = season.useSeasonStack ? season.seasonId : 'legacy';
  const board = await queryClient.fetchQuery({
    queryKey: ['homeSnapshot', 'match-center-last', gw],
    queryFn: () => api.getHomeSnapshot({ gw }),
    staleTime: STALE_MS,
  });
  const fixtures = (board?.fixtures ?? []) as Fixture[];
  const opensAtMs = gameweekOpensAtMs(fixtures);
  const leagueIds = leagues.map((league) => league.id).join(',');
  const month = getMonthForGw(gw, input.seasonKey);
  const monthLabel = month ? (month.label.split(' ')[0] ?? '').slice(0, 3) : '';

  const [liveRows, posts, meta, percentRows, tables, overall, chat] = await Promise.all([
    optional(async () => {
      const { data, error } = await supabase.from('live_scores').select('*').eq('gw', gw);
      if (error) throw error;
      return (data ?? []) as LiveScore[];
    }),
    input.postsOn
      ? optional(() =>
          queryClient.fetchQuery({
            queryKey: ['game-centre-posts', gw],
            queryFn: () => fetchGameCentrePosts(gw),
            staleTime: STALE_MS,
          }),
        )
      : Promise.resolve(null),
    optional(() =>
      queryClient.fetchQuery({
        queryKey: ['home-predictions-meta', gw],
        queryFn: () => api.getPredictions({ gw }),
        staleTime: STALE_MS,
      }),
    ),
    optional(() =>
      queryClient.fetchQuery({
        queryKey: ['match-center-pick-pct', gw, seasonCacheKey],
        queryFn: () => fetchPickPercentRows(gw, season),
        staleTime: STALE_MS,
      }),
    ),
    leagues.length
      ? optional(() =>
          queryClient.fetchQuery({
            queryKey: ['match-center-tables', gw, leagueIds],
            queryFn: () => fetchLeagueTables(gw, leagues),
            staleTime: STALE_MS,
          }),
        )
      : Promise.resolve(null),
    userId
      ? optional(() =>
          queryClient.fetchQuery({
            queryKey: ['match-center-overall-replay', gw, seasonCacheKey, monthLabel],
            queryFn: () => fetchOverallReplay(gw, season, month),
            staleTime: STALE_MS,
          }),
        )
      : Promise.resolve(null),
    // Without a start time the week would swallow every older message, so it waits for one.
    opensAtMs != null
      ? optional(() =>
          fetchLeagueChat({
            leagues,
            since: isoOrNull(opensAtMs),
            until: isoOrNull(input.untilMs),
            userId,
          }),
        )
      : Promise.resolve(null),
  ]);

  const memberIds = memberIdsOf(tables);
  const predictedPositions = normalizeTeamPositions((meta?.teamPositions ?? {}) as Record<string, unknown>);
  const [pickRows, fallbackPositions] = await Promise.all([
    memberIds.length
      ? optional(() =>
          queryClient.fetchQuery({
            queryKey: ['match-center-picks', gw, seasonCacheKey, memberIds.join(',')],
            queryFn: () => fetchMemberPicks(gw, memberIds, season),
            staleTime: STALE_MS,
          }),
        )
      : Promise.resolve(null),
    Object.keys(predictedPositions).length < 20
      ? optional(() =>
          queryClient.fetchQuery({
            queryKey: ['predictions-team-positions-home', gw],
            queryFn: () => fetchTeamPositionsWithFallback((meta?.teamPositions ?? {}) as Record<string, unknown>),
            staleTime: STALE_MS,
          }),
        )
      : Promise.resolve(null),
  ]);

  const live = liveRows ?? ((board?.liveScores ?? []) as LiveScore[]);
  const liveByApiMatchId = new Map<number, LiveScore>();
  live.forEach((row) => {
    if (typeof row.api_match_id === 'number') liveByApiMatchId.set(row.api_match_id, row);
  });
  const liveByFixtureIndex = indexLiveScoresByFixture(fixtures, live);
  const allFinished =
    fixtures.length > 0 &&
    fixtures.every((fixture) => resolveLiveScore(fixture, liveByFixtureIndex, liveByApiMatchId)?.status === 'FINISHED');
  const gwResults =
    allFinished && userId
      ? await optional(() =>
          queryClient.fetchQuery({
            queryKey: ['gwResults', gw, 'match-center'],
            queryFn: () => api.getGwResults(gw),
            staleTime: STALE_MS,
          }),
        )
      : null;

  const leaguePicks = tables ? leaguePicksFrom(tables, pickRows, leagues) : [];
  const replayOn = leaguePicks.some((league) => league.members.some((member) => Object.keys(member.picks).length > 0));
  const nowMs = Date.now();
  const feedPosts = posts && posts.length > 0 ? posts : null;
  const match = fixtures.length
    ? buildMatchFeed({
        gw,
        fixtures,
        liveByFixtureIndex,
        liveByApiMatchId,
        picks: (board?.userPicks ?? {}) as Record<string, Pick>,
        percents: pickPercentsFrom(percentRows),
        teamForms: normalizeTeamForms((meta?.teamForms ?? {}) as Record<string, string>),
        teamPositions: { ...(fallbackPositions ?? {}), ...predictedPositions },
        nowMs,
        userId,
        leagues: replayOn ? leaguePicks : [],
        overall: overall ? { ...overall, userAvatar: input.userAvatar } : null,
        lineupArrivalMs: new Map(),
        posts: feedPosts,
        sessionLive: false,
      })
    : [];
  const roundUp =
    allFinished && userId
      ? placeRoundUp(
          buildRoundUp({
            leagues: tables ?? [],
            userId,
            userAvatar: input.userAvatar,
            overallBefore: gwResults?.leaderboardChanges.overall.before ?? null,
            overallAfter: gwResults?.leaderboardChanges.overall.after ?? null,
          }),
          match,
        )
      : [];
  const messages = (chat ?? []).map((item) => ({
    ...item,
    sortAt: alignChatSortAtMs({
      createdAtMs: item.sortAt,
      fixtures,
      liveByFixtureIndex,
      liveByApiMatchId,
      nowMs,
    }),
  }));
  return {
    gw,
    opensAtMs,
    fixtures,
    social: !!feedPosts,
    items: [
      ...match,
      ...buildDerivedFeed({
        gw,
        fixtures,
        liveByFixtureIndex,
        liveByApiMatchId,
        picks: (board?.userPicks ?? {}) as Record<string, Pick>,
        userId,
        nowMs,
        deadlineMs: predictionsDeadlineMs(fixtures),
        allFinished,
        monthEndGw: month?.endGw ?? null,
        leagues: leaguePicks,
        tables: tables ?? [],
        joins: [],
        gwOpenMs: opensAtMs,
        liveTable: [],
        monthBefore: overall?.monthBefore ?? {},
        seasonBefore: overall?.beforeGw ?? {},
        people: new Map(),
        playersScores: {},
        nextHereWeGoMs: input.untilMs ?? hereWeGoMs(firstKickoffMs(fixtures)),
        percents: pickPercentsFrom(percentRows),
      }),
      ...roundUp,
      ...messages,
    ].sort(compareFeedItems),
  };
}
