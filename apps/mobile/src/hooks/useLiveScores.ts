import { useEffect, useMemo, useRef, useState } from 'react';
import type { LiveScore } from '@totl/domain';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

type Options = {
  /**
   * Optional seed data (e.g. from the BFF snapshot) to avoid pop-in.
   * This should be for the same GW as `gw`.
   */
  initial?: LiveScore[] | null | undefined;
};

type UseLiveScoresResult = {
  /** Raw list (useful for debugging / iteration). */
  liveScores: LiveScore[];
  /** Fast lookup by `fixture_index` (only for rows that have it). */
  liveByFixtureIndex: Map<number, LiveScore>;
  /** Fast lookup by `api_match_id`. */
  liveByApiMatchId: Map<number, LiveScore>;
  loading: boolean;
  error: string | null;
};

function isNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function scoreChanged(a: LiveScore | undefined, b: LiveScore): boolean {
  if (!a) return true;
  return (
    a.home_score !== b.home_score ||
    a.away_score !== b.away_score ||
    a.status !== b.status ||
    a.minute !== b.minute ||
    a.updated_at !== b.updated_at ||
    // Goals / cards can be large; stringify is fine given low frequency.
    JSON.stringify(a.goals) !== JSON.stringify(b.goals) ||
    JSON.stringify(a.red_cards) !== JSON.stringify(b.red_cards)
  );
}

/**
 * Subscribe to `live_scores` for a single GW.
 *
 * Mirrors the web/Despia approach:
 * - initial fetch
 * - Supabase Realtime subscription
 * - polling fallback if realtime fails or stalls
 */
export function useLiveScores(gw: number | null | undefined, options?: Options): UseLiveScoresResult {
  const initial = options?.initial ?? null;

  // Store as a map keyed by api_match_id so updates are stable and de-duped.
  const [byApiMatchId, setByApiMatchId] = useState<Map<number, LiveScore>>(() => {
    const m = new Map<number, LiveScore>();
    (initial ?? []).forEach((ls) => {
      if (!isNumber(ls.api_match_id)) return;
      m.set(ls.api_match_id, ls);
    });
    return m;
  });

  const [loading, setLoading] = useState<boolean>(() => (initial && initial.length > 0 ? false : true));
  const [error, setError] = useState<string | null>(null);

  // Keep latest GW in a ref so callbacks don't close over stale values.
  const gwRef = useRef<number | null>(typeof gw === 'number' ? gw : null);
  gwRef.current = typeof gw === 'number' ? gw : null;

  useEffect(() => {
    if (typeof gw !== 'number') {
      setLoading(false);
      setError(null);
      setByApiMatchId(new Map());
      return;
    }

    let alive = true;
    let channel: RealtimeChannel | null = null;
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    let stallCheckInterval: ReturnType<typeof setInterval> | null = null;
    let lastUpdateTime = Date.now();

    const stopPolling = () => {
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
    };

    const startPolling = () => {
      if (pollInterval) return;
      pollInterval = setInterval(() => {
        void fetchLiveScores();
      }, 5000);
    };

    async function fetchLiveScores() {
      if (!alive) return;
      try {
        const { data, error: fetchError } = await supabase.from('live_scores').select('*').eq('gw', gw);
        if (!alive) return;
        if (fetchError) {
          setError(fetchError.message);
          setLoading(false);
          return;
        }

        const rows = (data ?? []) as LiveScore[];
        setByApiMatchId((prev) => {
          const next = new Map(prev);
          let changed = false;

          // Upserts/updates
          rows.forEach((ls) => {
            if (!isNumber(ls.api_match_id)) return;
            const prevLs = prev.get(ls.api_match_id);
            if (scoreChanged(prevLs, ls)) {
              next.set(ls.api_match_id, ls);
              changed = true;
            }
          });

          // Deletes (if rows were pruned)
          const seen = new Set<number>();
          rows.forEach((ls) => {
            if (!isNumber(ls.api_match_id)) return;
            seen.add(ls.api_match_id);
          });
          prev.forEach((_v, key) => {
            if (!seen.has(key)) {
              next.delete(key);
              changed = true;
            }
          });

          if (changed) {
            lastUpdateTime = Date.now();
            // If polling was enabled due to stall, realtime is effectively flowing again.
            stopPolling();
            return new Map(next);
          }
          return prev;
        });

        setError(null);
        setLoading(false);
      } catch (e) {
        console.error('[useLiveScores/mobile] fetch error', e);
        if (!alive) return;
        setError(e instanceof Error ? e.message : 'Failed to fetch live scores');
        setLoading(false);
      }
    }

    // Seed from `initial` if provided and we haven't got anything yet.
    if (initial && initial.length > 0) {
      setByApiMatchId((prev) => {
        if (prev.size > 0) return prev;
        const m = new Map<number, LiveScore>();
        initial.forEach((ls) => {
          if (!isNumber(ls.api_match_id)) return;
          m.set(ls.api_match_id, ls);
        });
        return m;
      });
      setLoading(false);
    } else {
      setLoading(true);
    }

    void fetchLiveScores();

    const channelName = `live_scores_gw_${gw}`;
    channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_scores',
          filter: `gw=eq.${gw}`,
        },
        (payload) => {
          if (!alive) return;

          // Receiving any payload means realtime is flowing; stop polling.
          lastUpdateTime = Date.now();
          stopPolling();

          setByApiMatchId((prev) => {
            const next = new Map(prev);
            let changed = false;

            if (payload.eventType === 'DELETE') {
              const oldRow = payload.old as Partial<LiveScore>;
              if (isNumber(oldRow.api_match_id) && next.has(oldRow.api_match_id)) {
                next.delete(oldRow.api_match_id);
                changed = true;
              }
            } else {
              const newRow = payload.new as LiveScore;
              if (!isNumber(newRow.api_match_id)) return prev;
              const prevRow = prev.get(newRow.api_match_id);
              if (scoreChanged(prevRow, newRow)) {
                next.set(newRow.api_match_id, newRow);
                changed = true;
              }
            }

            return changed ? new Map(next) : prev;
          });
        }
      )
      .subscribe((status) => {
        if (!alive) return;
        if (status === 'SUBSCRIBED') return;
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          startPolling();
        }
      });

    // If realtime stalls, start polling.
    stallCheckInterval = setInterval(() => {
      if (!alive) return;
      const msSince = Date.now() - lastUpdateTime;
      if (msSince > 30_000) startPolling();
    }, 10_000);

    return () => {
      alive = false;
      stopPolling();
      if (stallCheckInterval) clearInterval(stallCheckInterval);
      stallCheckInterval = null;
      if (channel) {
        supabase.removeChannel(channel);
        channel = null;
      }
    };
    // Intentionally exclude `initial` from deps: it is a seed, not a driver.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gw]);

  const liveScores = useMemo(() => Array.from(byApiMatchId.values()), [byApiMatchId]);

  const liveByFixtureIndex = useMemo(() => {
    const m = new Map<number, LiveScore>();
    liveScores.forEach((ls) => {
      const idx = (ls as any).fixture_index;
      if (isNumber(idx)) m.set(idx, ls);
    });
    return m;
  }, [liveScores]);

  return {
    liveScores,
    liveByFixtureIndex,
    liveByApiMatchId: byApiMatchId,
    loading,
    error,
  };
}

