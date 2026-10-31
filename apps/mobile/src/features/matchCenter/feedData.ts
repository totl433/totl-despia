import type { Pick } from '@totl/domain';

import { api } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { getDefaultMlAvatarFilename, resolveLeagueAvatarUri } from '../../lib/leagueAvatars';
import { LEGACY_PILE_TABLES, SEASON_PILE_TABLES } from '../../lib/leagueSeasonPile';
import { fetchAllSupabaseRows } from '../../lib/profileStreakRows';
import { VOLLEY_USER_ID } from '../../lib/volley';
import { playersDayKey, shiftPlayersDay } from '../../lib/retroPlayers/day';
import { readSharedPlayersScores, scoreForDay, scoreForMonth, scoreForWeek, type PlayersScoreStore } from '../../lib/retroPlayers/scores';
import { chatMessageItem, type FeedItem, type LeaguePickSnap, type LeagueTableSnap, type OverallReplay, type PickPercents } from './feed';
import type { AdminFeedPost, FeedPerson, LeagueJoin } from './derivedFeed';
import { buildSeasonStatFacts, seasonPickKey, type SeasonFixture, type SeasonStatFacts } from './seasonStatFacts';

/**
 * What the Game Centre feed loads for one gameweek. The screen runs these through React
 * Query for the gameweek at the top of the feed; older gameweeks further down load them
 * the same way as the feed scrolls to them.
 */

export type FeedLeague = { id: string; name: string; avatar?: string | null };
/** Which picks tables to read: the 2026/27 season stack, or the legacy ones. */
export type FeedSeason = { useSeasonStack: boolean; seasonId: string | null };
export type MemberPickRow = {
  user_id: string;
  fixture_index: number;
  pick: string | null;
};

/** Room for a busy gameweek; the newest are kept if a window holds more. */
const CHAT_LIMIT = 500;

function leagueAvatarUri(league: FeedLeague): string | null {
  return resolveLeagueAvatarUri(league.avatar || getDefaultMlAvatarFilename(league.id));
}

export async function fetchLeagueTables(gw: number, leagues: FeedLeague[]): Promise<LeagueTableSnap[]> {
  const snaps = await Promise.all(
    leagues.map(async (league) => {
      const table = await api.getLeagueGwTable(league.id, gw);
      return {
        id: league.id,
        name: league.name,
        avatarUrl: leagueAvatarUri(league),
        submittedUserIds: table.submittedUserIds ?? [],
        rows: table.rows.map((row) => ({
          user_id: row.user_id,
          name: row.name,
          score: row.score,
          avatarUrl: null as string | null,
        })),
      };
    }),
  );
  const ids = [...new Set(snaps.flatMap((league) => league.rows.map((row) => row.user_id)))];
  const avatarById = new Map<string, string>();
  if (ids.length) {
    const { data: people } = await supabase.from('users').select('id, avatar_url').in('id', ids);
    (people ?? []).forEach((person) => {
      const avatar = typeof person.avatar_url === 'string' ? person.avatar_url.trim() : '';
      if (avatar) avatarById.set(String(person.id), avatar);
    });
  }
  return snaps.map((league) => ({
    ...league,
    rows: league.rows.map((row) => ({
      ...row,
      avatarUrl: avatarById.get(row.user_id) ?? null,
    })),
  }));
}

export function memberIdsOf(tables: LeagueTableSnap[] | null | undefined): string[] {
  const ids = new Set<string>();
  (tables ?? []).forEach((league) => league.rows.forEach((row) => ids.add(row.user_id)));
  return [...ids].sort();
}

export async function fetchMemberPicks(gw: number, memberIds: string[], season: FeedSeason): Promise<MemberPickRow[]> {
  const pileB = season.useSeasonStack && !!season.seasonId;
  let query = (supabase as any)
    .from(pileB ? 'app_season_picks' : 'app_picks')
    .select('user_id, fixture_index, pick')
    .eq('gw', gw)
    .in('user_id', memberIds);
  if (pileB) query = query.eq('season_id', season.seasonId);
  const { data, error } = await query.limit(2000);
  if (error) throw error;
  return (data ?? []) as MemberPickRow[];
}

export async function fetchPickPercentRows(gw: number, season: FeedSeason) {
  const pileB = season.useSeasonStack && !!season.seasonId;
  const tables = pileB ? SEASON_PILE_TABLES : LEGACY_PILE_TABLES;
  return fetchAllSupabaseRows<{ fixture_index: number; pick: string | null }>((from, to) => {
    let query = (supabase as any).from(tables.picks).select('fixture_index, pick').eq('gw', gw);
    if (pileB) query = query.eq('season_id', season.seasonId);
    return query.range(from, to);
  });
}

export function pickPercentsFrom(rows: Array<{ fixture_index: number; pick: string | null }> | null | undefined) {
  const counts = new Map<number, { H: number; D: number; A: number; total: number }>();
  (rows ?? []).forEach((row) => {
    if (row.pick !== 'H' && row.pick !== 'D' && row.pick !== 'A') return;
    if (typeof row.fixture_index !== 'number') return;
    const current = counts.get(row.fixture_index) ?? {
      H: 0,
      D: 0,
      A: 0,
      total: 0,
    };
    current[row.pick] += 1;
    current.total += 1;
    counts.set(row.fixture_index, current);
  });
  const out = new Map<number, PickPercents>();
  counts.forEach((count, fixtureIndex) => {
    if (count.total <= 0) return;
    out.set(fixtureIndex, {
      H: Math.round((count.H / count.total) * 100),
      D: Math.round((count.D / count.total) * 100),
      A: Math.round((count.A / count.total) * 100),
      votes: count.total,
    });
  });
  return out;
}

export async function fetchOverallReplay(
  gw: number,
  season: FeedSeason,
  month: { startGw: number; label: string } | null,
): Promise<OverallReplay> {
  const pileB = season.useSeasonStack && !!season.seasonId;
  const tables = pileB ? SEASON_PILE_TABLES : LEGACY_PILE_TABLES;
  const [points, everyone] = await Promise.all([
    fetchAllSupabaseRows<{ user_id: string; gw: number; points: number }>((from, to) => {
      let query = (supabase as any)
        .from(tables.gwPoints)
        .select('user_id, gw, points')
        .order('gw', { ascending: true })
        .order('user_id', { ascending: true })
        .range(from, to);
      if (pileB) query = query.eq('season_id', season.seasonId);
      return query;
    }),
    fetchAllSupabaseRows<MemberPickRow>((from, to) => {
      let query = (supabase as any).from(tables.picks).select('user_id, fixture_index, pick').eq('gw', gw);
      if (pileB) query = query.eq('season_id', season.seasonId);
      return query.range(from, to);
    }),
  ]);
  const beforeGw: Record<string, number> = {};
  const monthBefore: Record<string, number> = {};
  const monthStart = month?.startGw ?? gw;
  points.forEach((row) => {
    const id = String(row.user_id ?? '');
    const week = Number(row.gw);
    if (!id || !Number.isFinite(week) || week >= gw) return;
    const pts = Number(row.points ?? 0);
    beforeGw[id] = (beforeGw[id] ?? 0) + pts;
    if (week >= monthStart) monthBefore[id] = (monthBefore[id] ?? 0) + pts;
  });
  const picks: Record<string, Record<number, Pick>> = {};
  everyone.forEach((row) => {
    if (row.pick !== 'H' && row.pick !== 'D' && row.pick !== 'A') return;
    if (typeof row.fixture_index !== 'number') return;
    const id = String(row.user_id ?? '');
    if (!id) return;
    const bag = picks[id] ?? {};
    bag[row.fixture_index] = row.pick;
    picks[id] = bag;
  });
  return {
    beforeGw,
    monthBefore,
    monthLabel: month ? (month.label.split(' ')[0] ?? '').slice(0, 3) : '',
    picks,
  };
}

export function leaguePicksFrom(
  tables: LeagueTableSnap[],
  pickRows: MemberPickRow[] | null | undefined,
  leagues: FeedLeague[],
): LeaguePickSnap[] {
  const byUser = new Map<string, Record<number, Pick>>();
  (pickRows ?? []).forEach((row) => {
    if (row.pick !== 'H' && row.pick !== 'D' && row.pick !== 'A') return;
    const bag = byUser.get(row.user_id) ?? {};
    bag[row.fixture_index] = row.pick;
    byUser.set(row.user_id, bag);
  });
  const avatarByLeague = new Map(leagues.map((league) => [league.id, leagueAvatarUri(league)]));
  return tables.map((league) => ({
    id: league.id,
    name: league.name,
    avatarUrl: avatarByLeague.get(league.id) ?? resolveLeagueAvatarUri(getDefaultMlAvatarFilename(league.id)),
    members: league.rows.map((row) => ({
      userId: row.user_id,
      name: row.name,
      picks: byUser.get(row.user_id) ?? {},
    })),
  }));
}

/**
 * Mini-league messages sent from `since` up to (not including) `until`, oldest first, as
 * feed items. Either bound may be left open. Volley's own posts stay in league chat.
 */
export async function fetchLeagueChat(input: {
  leagues: FeedLeague[];
  since: string | null;
  until: string | null;
  userId: string | null;
}): Promise<FeedItem[]> {
  const { leagues, since, until, userId } = input;
  const ids = leagues.map((league) => league.id);
  if (!ids.length) return [];
  let query = supabase
    .from('league_messages')
    .select('id, league_id, user_id, content, created_at, reply_to:league_messages!reply_to_message_id(content)')
    .in('league_id', ids)
    .neq('user_id', VOLLEY_USER_ID);
  if (since) query = query.gte('created_at', since);
  if (until) query = query.lt('created_at', until);
  const { data, error } = await query.order('created_at', { ascending: false }).limit(CHAT_LIMIT);
  if (error) throw error;
  const rows = (data ?? []) as Array<{
    id: string;
    league_id: string;
    user_id: string;
    content: string | null;
    created_at: string;
    reply_to?: { content?: string | null } | Array<{ content?: string | null }> | null;
  }>;
  const nameById = new Map<string, string>();
  const avatarById = new Map<string, string>();
  const speakerIds = [...new Set(rows.map((row) => String(row.user_id)).filter(Boolean))];
  if (speakerIds.length) {
    const { data: people } = await supabase.from('users').select('id, name, avatar_url').in('id', speakerIds);
    (people ?? []).forEach((person) => {
      const name = typeof person.name === 'string' ? person.name.trim() : '';
      if (name) nameById.set(String(person.id), name);
      const avatar = typeof person.avatar_url === 'string' ? person.avatar_url.trim() : '';
      if (avatar) avatarById.set(String(person.id), avatar);
    });
  }
  const leagueName = new Map(leagues.map((league) => [league.id, league.name]));
  const leagueAvatar = new Map(leagues.map((league) => [league.id, leagueAvatarUri(league)]));
  return rows
    .slice()
    .reverse()
    .flatMap((row) => {
      if (String(row.user_id) === VOLLEY_USER_ID) return [];
      const body = String(row.content ?? '').trim();
      if (!body) return [];
      const replyRaw = row.reply_to;
      const reply = Array.isArray(replyRaw) ? replyRaw[0] : replyRaw;
      const replyTo = typeof reply?.content === 'string' ? reply.content.trim() : '';
      return [
        chatMessageItem({
          id: String(row.id),
          at: String(row.created_at),
          leagueId: String(row.league_id),
          leagueName: leagueName.get(String(row.league_id)) ?? 'Mini-league',
          author: nameById.get(String(row.user_id)) ?? 'Someone',
          body,
          mine: userId != null && String(row.user_id) === userId,
          replyTo: replyTo || null,
          authorAvatar: avatarById.get(String(row.user_id)) ?? null,
          leagueAvatar: leagueAvatar.get(String(row.league_id)) ?? null,
        }),
      ];
    });
}

export async function fetchPeople(ids: string[]): Promise<Map<string, FeedPerson>> {
  const unique = [...new Set(ids.filter(Boolean))];
  const out = new Map<string, FeedPerson>();
  if (!unique.length) return out;
  const { data } = await supabase.from('users').select('id, name, avatar_url').in('id', unique);
  (data ?? []).forEach((person) => {
    const id = String(person.id);
    const name = typeof person.name === 'string' ? person.name.trim() : '';
    const avatar = typeof person.avatar_url === 'string' ? person.avatar_url.trim() : '';
    out.set(id, { id, name: name || 'Someone', avatarUrl: avatar || null });
  });
  return out;
}

export async function fetchLeagueJoins(leagues: FeedLeague[]): Promise<LeagueJoin[]> {
  const ids = leagues.map((league) => league.id);
  if (!ids.length) return [];
  const { data, error } = await supabase.from('league_members').select('league_id, user_id, created_at').in('league_id', ids);
  if (error) throw error;
  const rows = (data ?? []) as Array<{ league_id: string; user_id: string; created_at?: string | null }>;
  const userIds = [...new Set(rows.map((row) => String(row.user_id)))];
  const people = await fetchPeople(userIds);
  const leagueName = new Map(leagues.map((league) => [league.id, league.name]));
  const leagueAvatar = new Map(leagues.map((league) => [league.id, leagueAvatarUri(league)]));
  return rows.flatMap((row) => {
    const joinedAtMs = row.created_at ? Date.parse(row.created_at) : Number.NaN;
    if (!Number.isFinite(joinedAtMs)) return [];
    const person = people.get(String(row.user_id));
    return [
      {
        leagueId: String(row.league_id),
        leagueName: leagueName.get(String(row.league_id)) ?? 'Mini-league',
        leagueAvatar: leagueAvatar.get(String(row.league_id)) ?? null,
        userId: String(row.user_id),
        name: person?.name || 'Someone',
        avatarUrl: person?.avatarUrl ?? null,
        joinedAtMs,
      },
    ];
  });
}

export type DerivedFeedExtras = {
  joins: LeagueJoin[];
  playersScores: Record<string, PlayersScoreStore>;
  people: Record<string, FeedPerson>;
  adminPosts: AdminFeedPost[];
};

export async function fetchAdminFeedPosts(): Promise<AdminFeedPost[]> {
  const dedicated = await supabase
    .from('game_centre_admin_posts')
    .select('id, title, body, comments, reacts, published_at')
    .order('published_at', { ascending: true })
    .limit(50);
  if (!dedicated.error && dedicated.data?.length) {
    return (dedicated.data as Array<{
      id: string;
      title?: string | null;
      body?: string | null;
      comments?: boolean | null;
      reacts?: boolean | null;
      published_at?: string | null;
    }>).flatMap((row) => {
      const publishedAtMs = row.published_at ? Date.parse(row.published_at) : Number.NaN;
      const body = String(row.body ?? '').trim();
      if (!Number.isFinite(publishedAtMs) || !body) return [];
      return [
        {
          id: String(row.id).split('admin:').pop() || String(row.id),
          title: String(row.title ?? 'Announcement').trim() || 'Announcement',
          body,
          publishedAtMs,
          comments: row.comments !== false,
          reacts: row.reacts !== false,
        },
      ];
    });
  }

  const fallback = await supabase
    .from('game_centre_posts')
    .select('id, details, published_at')
    .like('id', '%:admin:%')
    .order('published_at', { ascending: true })
    .limit(50);
  if (fallback.error || !fallback.data) return [];
  return (fallback.data as Array<{ id: string; details?: Record<string, unknown> | null; published_at?: string | null }>).flatMap((row) => {
    const details = row.details && typeof row.details === 'object' ? row.details : {};
    if (details.broadcast !== true) return [];
    const publishedAtMs = row.published_at ? Date.parse(row.published_at) : Number.NaN;
    const body = String(details.body ?? '').trim();
    const title = String(details.title ?? '').trim();
    if (!Number.isFinite(publishedAtMs) || !body || !title) return [];
    return [
      {
        id: String(row.id).split('admin:').pop() || String(row.id),
        title,
        body,
        publishedAtMs,
        comments: details.comments !== false,
        reacts: details.reacts !== false,
      },
    ];
  });
}

function topScoreIds(scores: Record<string, PlayersScoreStore>, scoreOf: (store: PlayersScoreStore) => number | null): string[] {
  const rows = Object.entries(scores)
    .map(([id, store]) => {
      const score = scoreOf(store);
      return score == null ? null : { id, score };
    })
    .filter((row): row is { id: string; score: number } => row != null);
  if (!rows.length) return [];
  const best = Math.max(...rows.map((row) => row.score));
  // Every winner: the Players winners cards show them all.
  return rows.filter((row) => row.score === best).map((row) => row.id);
}

export async function fetchDerivedFeedExtras(input: {
  leagues: FeedLeague[];
  extraIds?: string[];
}): Promise<DerivedFeedExtras> {
  const [joins, playersScores, adminPosts] = await Promise.all([
    fetchLeagueJoins(input.leagues),
    readSharedPlayersScores(),
    fetchAdminFeedPosts(),
  ]);
  const today = playersDayKey();
  const yesterday = shiftPlayersDay(today, -1);
  const ids = new Set(input.extraIds ?? []);
  joins.forEach((join) => ids.add(join.userId));
  topScoreIds(playersScores, (store) => scoreForDay(store, yesterday)).forEach((id) => ids.add(id));
  topScoreIds(playersScores, (store) => scoreForWeek(store, yesterday)).forEach((id) => ids.add(id));
  topScoreIds(playersScores, (store) => scoreForMonth(store, yesterday)).forEach((id) => ids.add(id));
  Object.entries(playersScores).forEach(([id, store]) => {
    if (store[today]?.correct === 10) ids.add(id);
  });
  const people = await fetchPeople([...ids]);
  return { joins, playersScores, people: Object.fromEntries(people.entries()), adminPosts };
}

export async function fetchSeasonStatFacts(season: FeedSeason): Promise<SeasonStatFacts> {
  const pileB = season.useSeasonStack && !!season.seasonId;
  const tables = pileB ? SEASON_PILE_TABLES : LEGACY_PILE_TABLES;
  const fixtures = await fetchAllSupabaseRows<SeasonFixture & Record<string, unknown>>((from, to) => {
    let query = (supabase as any)
      .from(tables.fixtures)
      .select('gw, fixture_index, api_match_id, home_code, away_code, home_name, away_name, home_team, away_team')
      .order('gw', { ascending: true })
      .order('fixture_index', { ascending: true })
      .range(from, to);
    if (pileB) query = query.eq('season_id', season.seasonId);
    return query;
  });
  const normalised: SeasonFixture[] = fixtures.map((row) => ({
    gw: Number(row.gw),
    fixture_index: Number(row.fixture_index),
    api_match_id: typeof row.api_match_id === 'number' ? row.api_match_id : null,
    home_code: String(row.home_code ?? '').toUpperCase(),
    away_code: String(row.away_code ?? '').toUpperCase(),
    home_name: String(row.home_name ?? row.home_team ?? ''),
    away_name: String(row.away_name ?? row.away_team ?? ''),
  }));
  const [results, pickRows, live] = await Promise.all([
    fetchAllSupabaseRows<{ gw: number; fixture_index: number; result: string }>((from, to) => {
      let query = (supabase as any).from(tables.results).select('gw, fixture_index, result').range(from, to);
      if (pileB) query = query.eq('season_id', season.seasonId);
      return query;
    }),
    fetchAllSupabaseRows<{ gw: number; fixture_index: number; pick: string | null }>((from, to) => {
      let query = (supabase as any).from(tables.picks).select('gw, fixture_index, pick').range(from, to);
      if (pileB) query = query.eq('season_id', season.seasonId);
      return query;
    }),
    fetchAllSupabaseRows<{
      api_match_id: number;
      status: string | null;
      home_score: number | null;
      away_score: number | null;
      home_team: string | null;
      away_team: string | null;
      goals: unknown;
    }>((from, to) => {
      const gws = [...new Set(normalised.map((row) => row.gw).filter((gw) => Number.isFinite(gw)))];
      if (!gws.length) return Promise.resolve({ data: [], error: null });
      return (supabase as any)
        .from('live_scores')
        .select('api_match_id, status, home_score, away_score, home_team, away_team, goals')
        .in('gw', gws)
        .range(from, to);
    }),
  ]);
  const seasonMatchIds = new Set(normalised.map((row) => row.api_match_id).filter((id): id is number => typeof id === 'number'));
  const pickCounts = new Map<string, { H: number; D: number; A: number; total: number }>();
  pickRows.forEach((row) => {
    if (row.pick !== 'H' && row.pick !== 'D' && row.pick !== 'A') return;
    const key = seasonPickKey(Number(row.gw), Number(row.fixture_index));
    const current = pickCounts.get(key) ?? { H: 0, D: 0, A: 0, total: 0 };
    current[row.pick] += 1;
    current.total += 1;
    pickCounts.set(key, current);
  });
  return buildSeasonStatFacts({
    fixtures: normalised,
    results,
    pickCounts,
    live: live.filter((row) => seasonMatchIds.has(row.api_match_id)),
  });
}
