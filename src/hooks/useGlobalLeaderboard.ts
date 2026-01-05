import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';

type OverallRow = {
  user_id: string;
  name: string | null;
  ocp: number;
};

type GwPointsRow = {
  user_id: string;
  gw: number;
  points: number;
};

export function useGlobalLeaderboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [latestGw, setLatestGw] = useState<number | null>(null);
  const [overall, setOverall] = useState<OverallRow[]>([]);
  const [gwPoints, setGwPoints] = useState<GwPointsRow[]>([]);
  const [prevOcp, setPrevOcp] = useState<Record<string, number>>({});

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setError('');

        // 1) latest GW from results
        const { data: latest, error: lErr } = await supabase
          .from('gw_results')
          .select('gw')
          .order('gw', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (lErr) throw lErr;
        const gw = latest?.gw ?? 1;
        if (alive) setLatestGw(gw);

        // 2) all GW points (needed for form leaderboards)
        const { data: gp, error: gErr } = await supabase
          .from('v_gw_points')
          .select('user_id, gw, points')
          .order('gw', { ascending: true });
        if (gErr) throw gErr;

        // 3) overall
        const { data: ocp, error: oErr } = await supabase
          .from('v_ocp_overall')
          .select('user_id, name, ocp');
        if (oErr) throw oErr;

        if (!alive) return;
        setGwPoints((gp as GwPointsRow[]) ?? []);
        setOverall((ocp as OverallRow[]) ?? []);

        // 4) previous OCP totals (up to gw-1) to compute rank movement
        if (gw && gw > 1) {
          const prevList = (gp as GwPointsRow[] | null)?.filter(r => r.gw < gw) ?? [];
          const totals: Record<string, number> = {};
          prevList.forEach((r) => {
            totals[r.user_id] = (totals[r.user_id] ?? 0) + (r.points ?? 0);
          });
          if (alive) setPrevOcp(totals);
        } else {
          if (alive) setPrevOcp({});
        }
      } catch (e: any) {
        if (alive) setError(e?.message ?? 'Failed to load leaderboard.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  function ranksFromScores(scores: Record<string, number>): Record<string, number> {
    const ids = Object.keys(scores);
    ids.sort((a, b) => (scores[b] ?? 0) - (scores[a] ?? 0) || a.localeCompare(b));
    const out: Record<string, number> = {};
    ids.forEach((id, i) => (out[id] = i + 1));
    return out;
  }

  const currRanks = useMemo(() => {
    const scores: Record<string, number> = {};
    overall.forEach((o) => {
      scores[o.user_id] = (o.ocp ?? 0);
    });
    gwPoints.forEach((g) => {
      if (!(g.user_id in scores)) scores[g.user_id] = g.points ?? 0;
    });
    return ranksFromScores(scores);
  }, [overall, gwPoints]);

  const prevRanks = useMemo(() => ranksFromScores(prevOcp), [prevOcp]);

  return {
    loading,
    error,
    latestGw,
    overall,
    gwPoints,
    prevRanks,
    currRanks,
  };
}



































