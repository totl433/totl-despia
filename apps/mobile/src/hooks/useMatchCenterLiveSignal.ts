import React from 'react';
import { AppState } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { Fixture, HomeSnapshot, LiveScore } from '@totl/domain';
import { api } from '../lib/api';
import { supabase } from '../lib/supabase';
import {
  firstKickoffMs,
  isMatchCenterLiveSignalActive,
  MATCH_CENTER_LINEUP_LEAD_MS,
} from '../features/matchCenter/feed';
import { indexLiveScoresByFixture } from '../lib/liveScoreRows';

/** Snapshot cadence for fixtures / GW — not used for second-by-second scores. */
const BOARD_STALE_MS = 45_000;
/** Slim live_scores poll — enough for lineups/status without a Realtime channel. */
const LIVE_POLL_MS = 45_000;

function mergeLiveMaps(
  fixtures: Fixture[],
  fromBoard: LiveScore[] | null | undefined,
  fromPoll: LiveScore[] | null | undefined
): { liveByFixtureIndex: Map<number, LiveScore>; liveByApiMatchId: Map<number, LiveScore> } {
  const liveByApiMatchId = new Map<number, LiveScore>();
  const apply = (rows: LiveScore[] | null | undefined) => {
    (rows ?? []).forEach((ls) => {
      if (typeof ls.api_match_id === 'number') liveByApiMatchId.set(ls.api_match_id, ls);
    });
  };
  // Poll overlays snapshot so lineups/status stay fresh.
  apply(fromBoard);
  apply(fromPoll);
  return {
    liveByFixtureIndex: indexLiveScoresByFixture(fixtures, liveByApiMatchId.values()),
    liveByApiMatchId,
  };
}

/**
 * App-wide: true from the first Match Center card until the round-up
 * (all fixtures finished). Used by the header LIVE control.
 *
 * Avoids a full `useLiveScores` Realtime subscription (Home/MC already own
 * those). Uses home snapshot + a slim live_scores poll instead.
 */
export function useMatchCenterLiveSignal(): boolean {
  const [nowMs, setNowMs] = React.useState(() => Date.now());

  const { data: home } = useQuery<HomeSnapshot>({
    queryKey: ['homeSnapshot'],
    queryFn: () => api.getHomeSnapshot(),
    staleTime: BOARD_STALE_MS,
    refetchInterval: BOARD_STALE_MS,
  });

  const currentGw = typeof home?.currentGw === 'number' ? home.currentGw : null;
  const viewingGw = typeof home?.viewingGw === 'number' ? home.viewingGw : null;
  const needsCurrentBoard = typeof currentGw === 'number' && viewingGw !== currentGw;

  const { data: currentBoard } = useQuery<HomeSnapshot>({
    enabled: needsCurrentBoard,
    queryKey: ['homeSnapshot', 'live-signal', currentGw],
    queryFn: () => api.getHomeSnapshot({ gw: currentGw as number }),
    staleTime: BOARD_STALE_MS,
    refetchInterval: BOARD_STALE_MS,
  });

  const board = needsCurrentBoard ? currentBoard : home;
  const fixtures: Fixture[] = board?.fixtures ?? [];
  const gw = currentGw;

  const { data: polledLive } = useQuery<LiveScore[]>({
    enabled: typeof gw === 'number',
    queryKey: ['match-center-live-signal-scores', gw],
    staleTime: LIVE_POLL_MS,
    refetchInterval: LIVE_POLL_MS,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('live_scores')
        .select('api_match_id, fixture_index, status, lineups, updated_at')
        .eq('gw', gw as number);
      if (error) throw error;
      return (data ?? []) as LiveScore[];
    },
  });

  const { liveByFixtureIndex, liveByApiMatchId } = React.useMemo(
    () => mergeLiveMaps(fixtures, board?.liveScores, polledLive),
    [board?.liveScores, fixtures, polledLive]
  );

  const firstKo = React.useMemo(() => firstKickoffMs(fixtures), [fixtures]);
  const teamsAtMs = firstKo != null ? firstKo - MATCH_CENTER_LINEUP_LEAD_MS : null;

  React.useEffect(() => {
    if (typeof teamsAtMs !== 'number') return;
    const delay = Math.max(0, Math.min(2_147_483_647, teamsAtMs - Date.now() + 50));
    const id = setTimeout(() => setNowMs(Date.now()), delay);
    return () => clearTimeout(id);
  }, [teamsAtMs]);

  React.useEffect(() => {
    // Keep "kickoff passed" fallback honest while fixtures are live.
    const id = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  React.useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setNowMs(Date.now());
    });
    return () => sub.remove();
  }, []);

  return React.useMemo(
    () =>
      isMatchCenterLiveSignalActive({
        fixtures,
        liveByFixtureIndex,
        liveByApiMatchId,
        nowMs,
      }),
    [fixtures, liveByApiMatchId, liveByFixtureIndex, nowMs]
  );
}
