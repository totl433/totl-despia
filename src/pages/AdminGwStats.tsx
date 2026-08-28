import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isWebBrowser } from '../lib/platform';
import { supabase } from '../lib/supabase';

const ADMIN_IDS = new Set([
  '4542c037-5b38-40d0-b189-847b8f17c222',
  '36f31625-6d6c-4aa4-815a-1493a812841b',
]);

type GwWindow = {
  startIso: string;
  endIso: string;
  startLabel: string;
  endLabel: string;
};

type GwStats = {
  submissions: number;
  signups: number;
  miniLeagues: number;
  window: GwWindow;
};

function formatShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function buildWindow(
  selectedGw: number,
  firstKickoffByGw: Map<number, string>,
  nowIso: string
): GwWindow {
  const thisKickoff = firstKickoffByGw.get(selectedGw) ?? nowIso;
  const prevKickoff = firstKickoffByGw.get(selectedGw - 1);
  const nextKickoff = firstKickoffByGw.get(selectedGw + 1);

  // GW cycle: after previous GW kicked off (or 14d before GW1) → next GW kickoff (or now).
  const startIso = prevKickoff
    ? prevKickoff
    : new Date(new Date(thisKickoff).getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const endIso = nextKickoff ?? nowIso;

  return {
    startIso,
    endIso,
    startLabel: formatShort(startIso),
    endLabel: nextKickoff ? formatShort(endIso) : `${formatShort(endIso)} (now)`,
  };
}

/**
 * Web-only admin page: submissions / new signups / new mini-leagues for a gameweek.
 */
export default function AdminGwStatsPage() {
  const { user } = useAuth();
  const isAdmin = !!user?.id && ADMIN_IDS.has(user.id);
  const webOnly = isWebBrowser();

  const [seasonId, setSeasonId] = useState<string | null>(null);
  const [seasonLabel, setSeasonLabel] = useState<string>('2026/27');
  const [currentGw, setCurrentGw] = useState<number | null>(null);
  const [availableGws, setAvailableGws] = useState<number[]>([]);
  const [firstKickoffByGw, setFirstKickoffByGw] = useState<Map<number, string>>(new Map());
  const [selectedGw, setSelectedGw] = useState<number | null>(null);
  const [stats, setStats] = useState<GwStats | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [loadingStats, setLoadingStats] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMeta = useCallback(async () => {
    setLoadingMeta(true);
    setError(null);
    try {
      const { data: runtime, error: runtimeErr } = await (supabase as any)
        .from('app_season_runtime')
        .select('current_gw, current_season_id')
        .eq('id', 1)
        .maybeSingle();
      if (runtimeErr) throw runtimeErr;

      const sid = typeof runtime?.current_season_id === 'string' ? runtime.current_season_id : null;
      const cgw = typeof runtime?.current_gw === 'number' ? runtime.current_gw : null;
      if (!sid) throw new Error('No active season found.');

      const { data: seasonRow } = await (supabase as any)
        .from('app_seasons')
        .select('label')
        .eq('id', sid)
        .maybeSingle();

      const { data: fixtures, error: fxErr } = await (supabase as any)
        .from('app_season_fixtures')
        .select('gw, kickoff_time')
        .eq('season_id', sid)
        .order('gw', { ascending: true })
        .order('kickoff_time', { ascending: true });
      if (fxErr) throw fxErr;

      const kickoffs = new Map<number, string>();
      const gwSet = new Set<number>();
      for (const row of fixtures ?? []) {
        const gw = Number(row.gw);
        if (!Number.isFinite(gw)) continue;
        gwSet.add(gw);
        if (!kickoffs.has(gw) && typeof row.kickoff_time === 'string') {
          kickoffs.set(gw, row.kickoff_time);
        }
      }
      const gws = [...gwSet].sort((a, b) => a - b);

      setSeasonId(sid);
      setSeasonLabel(typeof seasonRow?.label === 'string' ? seasonRow.label : '2026/27');
      setCurrentGw(cgw);
      setAvailableGws(gws);
      setFirstKickoffByGw(kickoffs);
      setSelectedGw((prev) => {
        if (prev && gws.includes(prev)) return prev;
        if (cgw && gws.includes(cgw)) return cgw;
        return gws.length ? gws[gws.length - 1] : null;
      });
    } catch (e: any) {
      console.error('[AdminGwStats] meta error:', e);
      setError(e?.message || 'Failed to load season meta.');
    } finally {
      setLoadingMeta(false);
    }
  }, []);

  const loadStats = useCallback(
    async (gw: number, sid: string, kickoffs: Map<number, string>) => {
      setLoadingStats(true);
      setError(null);
      try {
        const nowIso = new Date().toISOString();
        const window = buildWindow(gw, kickoffs, nowIso);

        const [subRes, signupRes, mlRes] = await Promise.all([
          (supabase as any)
            .from('app_season_submissions')
            .select('*', { count: 'exact', head: true })
            .eq('season_id', sid)
            .eq('gw', gw)
            .not('submitted_at', 'is', null),
          (supabase as any)
            .from('users')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', window.startIso)
            .lt('created_at', window.endIso),
          (supabase as any)
            .from('leagues')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', window.startIso)
            .lt('created_at', window.endIso),
        ]);

        if (subRes.error) throw subRes.error;
        if (signupRes.error) throw signupRes.error;
        if (mlRes.error) throw mlRes.error;

        setStats({
          submissions: typeof subRes.count === 'number' ? subRes.count : 0,
          signups: typeof signupRes.count === 'number' ? signupRes.count : 0,
          miniLeagues: typeof mlRes.count === 'number' ? mlRes.count : 0,
          window,
        });
      } catch (e: any) {
        console.error('[AdminGwStats] stats error:', e);
        setError(e?.message || 'Failed to load stats.');
        setStats(null);
      } finally {
        setLoadingStats(false);
      }
    },
    []
  );

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    if (!seasonId || selectedGw == null) return;
    void loadStats(selectedGw, seasonId, firstKickoffByGw);
  }, [seasonId, selectedGw, firstKickoffByGw, loadStats]);

  const isCurrent = useMemo(
    () => selectedGw != null && currentGw != null && selectedGw === currentGw,
    [selectedGw, currentGw]
  );

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="text-slate-600 mb-4">Please sign in to view admin stats.</div>
          <Link to="/profile" className="text-[#1C8376]">
            Go to Profile
          </Link>
        </div>
      </div>
    );
  }

  if (!isAdmin || !webOnly) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="text-slate-600 mb-4">
            {!webOnly ? 'This page is web-only.' : 'Access denied. Admin only.'}
          </div>
          <Link to="/profile" className="text-[#1C8376]">
            Go to Profile
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-lg mx-auto p-6">
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-semibold text-slate-800">GW Stats</h1>
            <Link to="/admin-data" className="text-slate-600" aria-label="Back to admin">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
          </div>
          <p className="text-sm text-slate-500 mb-6">
            Season {seasonLabel}
            {currentGw != null ? ` · published GW ${currentGw}` : ''}
          </p>

          {loadingMeta ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1C8376]" />
            </div>
          ) : (
            <>
              <label className="block text-sm font-medium text-slate-700 mb-2" htmlFor="gw-select">
                Gameweek
              </label>
              <div className="flex items-center gap-2 mb-6">
                <select
                  id="gw-select"
                  className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-800"
                  value={selectedGw ?? ''}
                  onChange={(e) => setSelectedGw(Number(e.target.value))}
                  disabled={!availableGws.length}
                >
                  {availableGws.map((gw) => (
                    <option key={gw} value={gw}>
                      Gameweek {gw}
                      {gw === currentGw ? ' (current)' : ''}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    if (seasonId && selectedGw != null) {
                      void loadStats(selectedGw, seasonId, firstKickoffByGw);
                    }
                  }}
                  className="px-3 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50"
                >
                  Refresh
                </button>
              </div>

              {isCurrent && (
                <div className="mb-4 text-xs font-medium text-[#1C8376] bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                  Viewing the published current gameweek
                </div>
              )}

              {error && (
                <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              {loadingStats ? (
                <div className="flex justify-center py-10">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1C8376]" />
                </div>
              ) : stats ? (
                <>
                  <div className="grid grid-cols-1 gap-3">
                    <StatCard
                      label="Submissions"
                      value={stats.submissions}
                      hint={`Players who submitted GW ${selectedGw}`}
                    />
                    <StatCard
                      label="New sign-ups"
                      value={stats.signups}
                      hint="Accounts created in this GW cycle"
                    />
                    <StatCard
                      label="New mini leagues"
                      value={stats.miniLeagues}
                      hint="Leagues created in this GW cycle"
                    />
                  </div>
                  <p className="mt-5 text-xs text-slate-500 leading-relaxed">
                    Sign-ups and mini leagues use the cycle window from the previous GW’s first kickoff
                    {selectedGw === 1 ? ' (or 14 days before GW1)' : ''} through{' '}
                    {availableGws.includes((selectedGw ?? 0) + 1)
                      ? 'the next GW’s first kickoff'
                      : 'now'}
                    : {stats.window.startLabel} → {stats.window.endLabel}.
                  </p>
                </>
              ) : (
                <div className="text-sm text-slate-500 py-6 text-center">No stats yet.</div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-3xl font-bold tabular-nums text-[#1C8376]">{value.toLocaleString()}</div>
      <div className="mt-1 text-xs text-slate-500">{hint}</div>
    </div>
  );
}
