import React from 'react';
import { AppState } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { Fixture, HomeSnapshot, LiveScore } from '@totl/domain';
import { api } from '../lib/api';
import {
  firstKickoffMs,
  isMatchCenterLiveSignalActive,
  MATCH_CENTER_LINEUP_LEAD_MS,
} from '../features/matchCenter/feed';
import { useLiveScores } from './useLiveScores';

/**
 * App-wide: true from the first Match Center card until the round-up
 * (all fixtures finished). Used by the header LIVE control.
 */
export function useMatchCenterLiveSignal(): boolean {
  const [nowMs, setNowMs] = React.useState(() => Date.now());

  const { data: home } = useQuery<HomeSnapshot>({
    queryKey: ['homeSnapshot'],
    queryFn: () => api.getHomeSnapshot(),
    staleTime: 30_000,
  });

  const currentGw = typeof home?.currentGw === 'number' ? home.currentGw : null;
  const viewingGw = typeof home?.viewingGw === 'number' ? home.viewingGw : null;
  const needsCurrentBoard = typeof currentGw === 'number' && viewingGw !== currentGw;

  const { data: currentBoard } = useQuery<HomeSnapshot>({
    enabled: needsCurrentBoard,
    queryKey: ['homeSnapshot', 'live-signal', currentGw],
    queryFn: () => api.getHomeSnapshot({ gw: currentGw as number }),
    staleTime: 30_000,
  });

  const board = needsCurrentBoard ? currentBoard : home;
  const fixtures: Fixture[] = board?.fixtures ?? [];
  const gw = currentGw;

  const { liveByFixtureIndex, liveByApiMatchId } = useLiveScores(gw, {
    initial: board?.liveScores ?? [],
  });

  const liveByIndex = React.useMemo(() => {
    if (liveByFixtureIndex.size > 0) return liveByFixtureIndex;
    const m = new Map<number, LiveScore>();
    const apiToIdx = new Map<number, number>();
    fixtures.forEach((f) => {
      if (typeof f.api_match_id === 'number') apiToIdx.set(f.api_match_id, f.fixture_index);
    });
    (board?.liveScores ?? []).forEach((ls) => {
      const idx =
        typeof ls.fixture_index === 'number'
          ? ls.fixture_index
          : typeof ls.api_match_id === 'number'
            ? apiToIdx.get(ls.api_match_id)
            : undefined;
      if (typeof idx !== 'number') return;
      m.set(idx, ls);
    });
    return m;
  }, [board?.liveScores, fixtures, liveByFixtureIndex]);

  const firstKo = React.useMemo(() => firstKickoffMs(fixtures), [fixtures]);
  const teamsAtMs = firstKo != null ? firstKo - MATCH_CENTER_LINEUP_LEAD_MS : null;

  React.useEffect(() => {
    if (typeof teamsAtMs !== 'number') return;
    const delay = Math.max(0, Math.min(2_147_483_647, teamsAtMs - Date.now() + 50));
    const id = setTimeout(() => setNowMs(Date.now()), delay);
    return () => clearTimeout(id);
  }, [teamsAtMs]);

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
        liveByFixtureIndex: liveByIndex,
        liveByApiMatchId,
        nowMs,
      }),
    [fixtures, liveByApiMatchId, liveByIndex, nowMs]
  );
}
