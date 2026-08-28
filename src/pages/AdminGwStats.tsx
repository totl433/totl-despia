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

type SignupRow = {
  id: string;
  name: string;
  createdAt: string;
  submittedSelectedGw: boolean;
  leagues: string[];
};

type GwStats = {
  submissions: number;
  signups: number;
  miniLeagues: number;
  chatMessages: number;
  chatLeagues: number;
  window: GwWindow;
  signupRows: SignupRow[];
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
  nowIso: string,
  currentGw: number | null
): GwWindow {
  const thisKickoff = firstKickoffByGw.get(selectedGw) ?? nowIso;
  const prevKickoff = firstKickoffByGw.get(selectedGw - 1);

  // Non-overlapping cycles: (prev KO | 14d before GW1) → this GW first KO.
  // For the live published GW after its kickoff, extend to now so new arrivals still show.
  const startIso = prevKickoff
    ? prevKickoff
    : new Date(new Date(thisKickoff).getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();

  const thisMs = new Date(thisKickoff).getTime();
  const nowMs = new Date(nowIso).getTime();
  const isLiveCurrent =
    currentGw != null && selectedGw === currentGw && nowMs >= thisMs;
  const endIso = isLiveCurrent ? nowIso : thisKickoff;

  return {
    startIso,
    endIso,
    startLabel: formatShort(startIso),
    endLabel: isLiveCurrent ? `${formatShort(endIso)} (now)` : formatShort(endIso),
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
  const [signupsOpen, setSignupsOpen] = useState(false);

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
    async (
      gw: number,
      sid: string,
      kickoffs: Map<number, string>,
      publishedGw: number | null
    ) => {
      setLoadingStats(true);
      setError(null);
      try {
        const nowIso = new Date().toISOString();
        const window = buildWindow(gw, kickoffs, nowIso, publishedGw);

        const [subRes, signupRes, mlRes, chatRes] = await Promise.all([
          (supabase as any)
            .from('app_season_submissions')
            .select('*', { count: 'exact', head: true })
            .eq('season_id', sid)
            .eq('gw', gw)
            .not('submitted_at', 'is', null),
          (supabase as any)
            .from('users')
            .select('id, name, created_at')
            .gte('created_at', window.startIso)
            .lt('created_at', window.endIso)
            .order('created_at', { ascending: false }),
          (supabase as any)
            .from('leagues')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', window.startIso)
            .lt('created_at', window.endIso),
          (supabase as any)
            .from('league_messages')
            .select('league_id')
            .gte('created_at', window.startIso)
            .lt('created_at', window.endIso),
        ]);

        if (subRes.error) throw subRes.error;
        if (signupRes.error) throw signupRes.error;
        if (mlRes.error) throw mlRes.error;
        if (chatRes.error) throw chatRes.error;

        // Paginate chat if over default page size
        let chatRows: Array<{ league_id: string }> = chatRes.data ?? [];
        if (chatRows.length >= 1000) {
          let from = 1000;
          while (true) {
            const { data, error } = await (supabase as any)
              .from('league_messages')
              .select('league_id')
              .gte('created_at', window.startIso)
              .lt('created_at', window.endIso)
              .range(from, from + 999);
            if (error) throw error;
            if (!data?.length) break;
            chatRows = chatRows.concat(data);
            if (data.length < 1000) break;
            from += 1000;
          }
        }

        const chatLeagueIds = new Set(
          chatRows.map((r) => r.league_id).filter((id): id is string => typeof id === 'string')
        );

        const signupUsers: Array<{ id: string; name: string | null; created_at: string }> =
          signupRes.data ?? [];
        const signupIds = signupUsers.map((u) => u.id);

        let submittedIds = new Set<string>();
        const leaguesByUser = new Map<string, string[]>();

        if (signupIds.length > 0) {
          const [submittedRes, membersRes] = await Promise.all([
            (supabase as any)
              .from('app_season_submissions')
              .select('user_id')
              .eq('season_id', sid)
              .eq('gw', gw)
              .in('user_id', signupIds)
              .not('submitted_at', 'is', null),
            (supabase as any)
              .from('league_members')
              .select('user_id, leagues(name)')
              .in('user_id', signupIds),
          ]);

          if (submittedRes.error) throw submittedRes.error;
          if (membersRes.error) throw membersRes.error;

          submittedIds = new Set(
            ((submittedRes.data ?? []) as Array<{ user_id: string }>).map((r) => r.user_id)
          );

          for (const row of membersRes.data ?? []) {
            const userId = typeof row.user_id === 'string' ? row.user_id : null;
            if (!userId) continue;
            const leagueName =
              row.leagues && typeof row.leagues === 'object' && !Array.isArray(row.leagues)
                ? (row.leagues as { name?: string | null }).name
                : Array.isArray(row.leagues)
                  ? (row.leagues[0] as { name?: string | null } | undefined)?.name
                  : null;
            if (!leagueName) continue;
            const list = leaguesByUser.get(userId) ?? [];
            if (!list.includes(leagueName)) list.push(leagueName);
            leaguesByUser.set(userId, list);
          }
        }

        const signupRows: SignupRow[] = signupUsers.map((u) => ({
          id: u.id,
          name: (u.name && String(u.name).trim()) || 'Unnamed',
          createdAt: u.created_at,
          submittedSelectedGw: submittedIds.has(u.id),
          leagues: leaguesByUser.get(u.id) ?? [],
        }));

        setStats({
          submissions: typeof subRes.count === 'number' ? subRes.count : 0,
          signups: signupRows.length,
          miniLeagues: typeof mlRes.count === 'number' ? mlRes.count : 0,
          chatMessages: chatRows.length,
          chatLeagues: chatLeagueIds.size,
          window,
          signupRows,
        });
        setSignupsOpen(false);
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
    void loadStats(selectedGw, seasonId, firstKickoffByGw, currentGw);
  }, [seasonId, selectedGw, firstKickoffByGw, currentGw, loadStats]);

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
                      void loadStats(selectedGw, seasonId, firstKickoffByGw, currentGw);
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
                    <div className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
                      <button
                        type="button"
                        className="w-full px-4 py-4 text-left hover:bg-slate-100/70 transition-colors"
                        onClick={() => setSignupsOpen((o) => !o)}
                        aria-expanded={signupsOpen}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              New sign-ups
                            </div>
                            <div className="mt-1 text-3xl font-bold tabular-nums text-[#1C8376]">
                              {stats.signups.toLocaleString()}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              Accounts created in this GW cycle
                              {stats.signups > 0 ? ' · tap to view who' : ''}
                            </div>
                          </div>
                          {stats.signups > 0 && (
                            <svg
                              className={`w-5 h-5 text-slate-400 mt-1 shrink-0 transition-transform ${
                                signupsOpen ? 'rotate-180' : ''
                              }`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                              aria-hidden
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 9l-7 7-7-7"
                              />
                            </svg>
                          )}
                        </div>
                      </button>
                      {signupsOpen && stats.signups > 0 && (
                        <div className="border-t border-slate-200 bg-white px-3 py-2 max-h-80 overflow-y-auto">
                          <ul className="divide-y divide-slate-100">
                            {stats.signupRows.map((row) => (
                              <li key={row.id} className="py-3 px-1">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="font-medium text-slate-800 truncate">{row.name}</div>
                                    <div className="text-xs text-slate-500 mt-0.5">
                                      Joined {formatShort(row.createdAt)}
                                    </div>
                                    <div className="text-xs text-slate-500 mt-0.5">
                                      {row.leagues.length
                                        ? `Leagues: ${row.leagues.join(', ')}`
                                        : 'No mini league yet'}
                                    </div>
                                  </div>
                                  <span
                                    className={`shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                                      row.submittedSelectedGw
                                        ? 'bg-emerald-50 text-emerald-700'
                                        : 'bg-amber-50 text-amber-700'
                                    }`}
                                  >
                                    {row.submittedSelectedGw
                                      ? `GW${selectedGw} submitted`
                                      : `GW${selectedGw} missing`}
                                  </span>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                    <StatCard
                      label="New mini leagues"
                      value={stats.miniLeagues}
                      hint="Leagues created in this GW cycle"
                    />
                    <StatCard
                      label="Chat messages"
                      value={stats.chatMessages}
                      hint={
                        stats.chatLeagues === 0
                          ? 'No chat activity in this GW cycle'
                          : `Across ${stats.chatLeagues.toLocaleString()} mini league${
                              stats.chatLeagues === 1 ? '' : 's'
                            }`
                      }
                    />
                  </div>
                  <p className="mt-5 text-xs text-slate-500 leading-relaxed">
                    Sign-ups, mini leagues, and chat use non-overlapping cycle windows: from the previous
                    GW’s first kickoff
                    {selectedGw === 1 ? ' (or 14 days before GW1)' : ''} through this GW’s first kickoff
                    {selectedGw === currentGw ? ' (or now, while this GW is live)' : ''}:{' '}
                    {stats.window.startLabel} → {stats.window.endLabel}.
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
