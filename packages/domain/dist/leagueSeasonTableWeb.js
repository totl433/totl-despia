/**
 * Mini-league season table — same scoring rules as playtotl `League.tsx`.
 * **Start GW** uses activation vs first kickoffs in **calendar order** (not raw `gw` number order — IDs can be non-chronological).
 * **Picks** load fully via per-member paging (no 1000-row scoring cap).
 */
const DEADLINE_BUFFER_MINUTES = 75;
function parseOptionalGwColumn(value) {
    if (value == null)
        return null;
    if (typeof value === 'number' && Number.isFinite(value))
        return Math.trunc(value);
    if (typeof value === 'string' && value.trim() !== '') {
        const n = Number.parseInt(value.trim(), 10);
        if (Number.isFinite(n))
            return n;
    }
    return null;
}
const LEAGUE_START_OVERRIDES = {
    'Prem Predictions': 0,
    'FC Football': 0,
    'Easy League': 0,
    'API Test': 999,
    'The Bird league': 7,
    gregVjofVcarl: 8,
    'Let Down': 8,
};
function getLeagueStartOverride(name) {
    if (!name)
        return undefined;
    return LEAGUE_START_OVERRIDES[name];
}
/** Same rule as playtotl `src/lib/leagueStart.ts` `isIsoDate` (excludes date-only `YYYY-MM-DD`). */
function isIsoDateWebStyle(value) {
    return typeof value === 'string' && value.length > 10;
}
/** Second member’s `league_members.created_at` — same as playtotl `getLeagueActivationAt` (ISO join strings only). */
export function getLeagueActivationAt(members) {
    const joinedAt = (members ?? [])
        .map((m) => m.created_at)
        .filter(isIsoDateWebStyle)
        .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    return joinedAt[1] ?? null;
}
async function fetchLeagueRowForSeason(supa, leagueId) {
    let res = await supa.from('leagues').select('id, name, code, created_at, start_gw').eq('id', leagueId).maybeSingle();
    if (res.error) {
        res = await supa.from('leagues').select('id, name, code, created_at').eq('id', leagueId).maybeSingle();
    }
    if (res.error)
        throw res.error;
    return res.data;
}
async function ensureLeagueMeta(supa, league) {
    const needsName = typeof league.name !== 'string';
    const needsCreatedAt = typeof league.created_at !== 'string';
    const needsStartGw = parseOptionalGwColumn(league.start_gw) === null;
    if (!needsName && !needsCreatedAt && !needsStartGw)
        return league;
    let sel = await supa.from('leagues').select('name, created_at, start_gw').eq('id', league.id).maybeSingle();
    if (sel.error) {
        sel = await supa.from('leagues').select('name, created_at').eq('id', league.id).maybeSingle();
    }
    if (sel.error || !sel.data)
        return league;
    const data = sel.data;
    const fetchedStart = parseOptionalGwColumn(data.start_gw);
    return {
        ...league,
        name: needsName ? data.name : league.name,
        created_at: needsCreatedAt ? data.created_at : league.created_at,
        start_gw: needsStartGw ? fetchedStart : parseOptionalGwColumn(league.start_gw),
    };
}
/**
 * `app_gw_results.gw` is not always chronological vs real kickoffs (e.g. id "2" can be later in the season
 * than "8"). Never iterate completed GWs by numeric `gw` when resolving activation → start GW.
 */
export async function orderCompletedGwsByFirstKickoff(supa, completedGws) {
    if (completedGws.length === 0)
        return [];
    const unique = [...new Set(completedGws.filter((g) => Number.isFinite(g)))];
    const { data, error } = await supa
        .from('app_fixtures')
        .select('gw,kickoff_time')
        .in('gw', unique)
        .not('kickoff_time', 'is', null);
    if (error || !data?.length) {
        return unique.sort((a, b) => a - b);
    }
    const earliestMsByGw = new Map();
    for (const row of data) {
        const gw = Number(row.gw);
        if (!Number.isFinite(gw) || typeof row.kickoff_time !== 'string')
            continue;
        const t = new Date(row.kickoff_time).getTime();
        if (!Number.isFinite(t))
            continue;
        const prev = earliestMsByGw.get(gw);
        if (prev === undefined || t < prev)
            earliestMsByGw.set(gw, t);
    }
    const withKickoff = unique.filter((g) => earliestMsByGw.has(g));
    const missing = unique.filter((g) => !earliestMsByGw.has(g)).sort((a, b) => a - b);
    withKickoff.sort((a, b) => (earliestMsByGw.get(a) - earliestMsByGw.get(b)));
    return [...withKickoff, ...missing];
}
export async function resolveLeagueStartGwWeb(supa, league, currentGw, opts) {
    if (!league?.id)
        return currentGw;
    const withMeta = await ensureLeagueMeta(supa, league);
    const override = getLeagueStartOverride(withMeta.name ?? null);
    if (typeof override === 'number')
        return override;
    const startFromColumn = parseOptionalGwColumn(withMeta.start_gw);
    if (!opts?.matchLeaguePageEffect && startFromColumn !== null)
        return startFromColumn;
    const anchorTs = withMeta.activation_at ?? withMeta.created_at;
    if (anchorTs && currentGw) {
        const anchorTime = new Date(anchorTs);
        const { data: resultsData } = await supa.from('app_gw_results').select('gw').order('gw', { ascending: true });
        const completedGws = resultsData ? [...new Set(resultsData.map((r) => r.gw))] : [];
        const completedOrdered = await orderCompletedGwsByFirstKickoff(supa, completedGws);
        for (const gw of completedOrdered) {
            const { data: firstFixture } = await supa
                .from('app_fixtures')
                .select('kickoff_time')
                .eq('gw', gw)
                .order('kickoff_time', { ascending: true })
                .limit(1)
                .maybeSingle();
            if (firstFixture?.kickoff_time) {
                const firstKickoff = new Date(firstFixture.kickoff_time);
                const deadlineTime = new Date(firstKickoff.getTime() - DEADLINE_BUFFER_MINUTES * 60 * 1000);
                if (anchorTime < deadlineTime)
                    return gw;
            }
        }
        if (completedGws.length > 0)
            return Math.max(...completedGws) + 1;
        return currentGw;
    }
    return currentGw;
}
function rowToOutcome(r) {
    if (r.result === 'H' || r.result === 'D' || r.result === 'A')
        return r.result;
    if (typeof r.home_goals === 'number' && typeof r.away_goals === 'number') {
        if (r.home_goals > r.away_goals)
            return 'H';
        if (r.home_goals < r.away_goals)
            return 'A';
        return 'D';
    }
    return null;
}
function emptyRows(memberList) {
    return memberList.map((m) => ({
        user_id: m.id,
        name: m.name,
        mltPts: 0,
        ocp: 0,
        unicorns: 0,
        wins: 0,
        draws: 0,
        form: [],
    }));
}
export async function computeWebParityMiniLeagueSeasonRows(supa, leagueId, preload, options) {
    const metaRes = await supa.from('app_meta').select('current_gw').eq('id', 1).maybeSingle();
    if (metaRes.error)
        throw metaRes.error;
    const currentGwRaw = metaRes.data?.current_gw;
    const currentGw = typeof currentGwRaw === 'number' && Number.isFinite(currentGwRaw) ? Math.trunc(currentGwRaw) : 1;
    // Same roster query shape as web `useLeagueMeta` (users join + `created_at`). Always prefer this over
    // preload-only rosters: preload can omit join times; a bare `created_at`-only query can return fewer
    // rows under RLS than this select, which mis-anchors the season and inflates Season stats vs the web.
    const membersRes = await supa
        .from('league_members')
        .select('user_id, created_at, users(id, name, avatar_url)')
        .eq('league_id', leagueId)
        .limit(200);
    if (membersRes.error)
        throw membersRes.error;
    const members = (membersRes.data ?? []).map((m) => ({
        id: String(m.users?.id ?? m.user_id),
        name: typeof m.users?.name === 'string' ? m.users.name : 'User',
        created_at: typeof m.created_at === 'string' ? m.created_at : null,
    }));
    if (members.length < 2)
        return [];
    const activationAt = getLeagueActivationAt(members.map((m) => ({ created_at: m.created_at ?? null })));
    const leagueRes = await fetchLeagueRowForSeason(supa, leagueId);
    let league = leagueRes;
    if (!league && preload?.league && String(preload.league.id) === String(leagueId)) {
        league = {
            id: String(leagueId),
            name: preload.league.name ?? undefined,
            created_at: preload.league.created_at ?? null,
        };
    }
    if (!league)
        return [];
    if (league.name === 'API Test') {
        return emptyRows(members);
    }
    const { data: rs, error: rsErr } = await supa.from('app_gw_results').select('gw,fixture_index,result');
    if (rsErr)
        throw rsErr;
    const resultList = rs ?? [];
    const outcomeByGwIdx = new Map();
    resultList.forEach((r) => {
        const out = rowToOutcome(r);
        if (!out)
            return;
        outcomeByGwIdx.set(`${r.gw}:${r.fixture_index}`, out);
    });
    if (outcomeByGwIdx.size === 0) {
        return emptyRows(members);
    }
    const gwsWithResults = [...new Set(Array.from(outcomeByGwIdx.keys()).map((k) => parseInt(k.split(':')[0], 10)))].sort((a, b) => a - b);
    const specialLeagues = ['Prem Predictions', 'FC Football', 'Easy League'];
    const gw7StartLeagues = ['The Bird league'];
    const hintGw = options?.leagueStartGw;
    const leagueStartGw = typeof hintGw === 'number' && Number.isFinite(hintGw) && hintGw >= 1
        ? Math.trunc(hintGw)
        : await resolveLeagueStartGwWeb(supa, {
            id: league.id,
            name: league.name,
            created_at: league.created_at ?? null,
            activation_at: activationAt,
        }, currentGw, { matchLeaguePageEffect: false });
    let relevantGws = await computeRelevantGwsWindow(supa, gwsWithResults, leagueStartGw, currentGw, outcomeByGwIdx);
    if (!specialLeagues.includes(league.name || '') && !gw7StartLeagues.includes(league.name || '') && relevantGws.length === 0) {
        return emptyRows(members);
    }
    let picksAll = [];
    if (relevantGws.length > 0) {
        picksAll = await fetchAllAppPicksForMiniLeagueSeason(supa, members.map((m) => m.id), relevantGws);
    }
    const perGw = new Map();
    relevantGws.forEach((g) => {
        const map = new Map();
        members.forEach((m) => map.set(m.id, { user_id: m.id, score: 0, unicorns: 0 }));
        perGw.set(g, map);
    });
    relevantGws.forEach((g) => {
        const idxInGw = Array.from(outcomeByGwIdx.entries())
            .filter(([k]) => parseInt(k.split(':')[0], 10) === g)
            .map(([k, v]) => ({ idx: parseInt(k.split(':')[1], 10), out: v }));
        idxInGw.forEach(({ idx, out }) => {
            const thesePicks = picksAll.filter((p) => p.gw === g && p.fixture_index === idx);
            const correctUsers = thesePicks.filter((p) => p.pick === out).map((p) => p.user_id);
            const map = perGw.get(g);
            thesePicks.forEach((p) => {
                if (p.pick === out) {
                    const row = map.get(p.user_id);
                    row.score += 1;
                }
            });
            if (correctUsers.length === 1 && members.length >= 3) {
                const uid = correctUsers[0];
                const row = map.get(uid);
                row.unicorns += 1;
            }
        });
    });
    const mltPts = new Map();
    const ocp = new Map();
    const unis = new Map();
    const wins = new Map();
    const draws = new Map();
    const form = new Map();
    members.forEach((m) => {
        mltPts.set(m.id, 0);
        ocp.set(m.id, 0);
        unis.set(m.id, 0);
        wins.set(m.id, 0);
        draws.set(m.id, 0);
        form.set(m.id, []);
    });
    relevantGws.forEach((g) => {
        const rows = Array.from(perGw.get(g).values());
        rows.forEach((r) => {
            ocp.set(r.user_id, (ocp.get(r.user_id) ?? 0) + r.score);
            unis.set(r.user_id, (unis.get(r.user_id) ?? 0) + r.unicorns);
        });
        rows.sort((a, b) => b.score - a.score || b.unicorns - a.unicorns);
        if (!rows.length)
            return;
        const top = rows[0];
        const coTop = rows.filter((r) => r.score === top.score && r.unicorns === top.unicorns);
        if (coTop.length === 1) {
            mltPts.set(top.user_id, (mltPts.get(top.user_id) ?? 0) + 3);
            wins.set(top.user_id, (wins.get(top.user_id) ?? 0) + 1);
            form.get(top.user_id).push('W');
            rows.slice(1).forEach((r) => form.get(r.user_id).push('L'));
        }
        else {
            coTop.forEach((r) => {
                mltPts.set(r.user_id, (mltPts.get(r.user_id) ?? 0) + 1);
                draws.set(r.user_id, (draws.get(r.user_id) ?? 0) + 1);
                form.get(r.user_id).push('D');
            });
            rows
                .filter((r) => !coTop.find((t) => t.user_id === r.user_id))
                .forEach((r) => form.get(r.user_id).push('L'));
        }
    });
    const rows = members.map((m) => ({
        user_id: m.id,
        name: m.name,
        mltPts: mltPts.get(m.id) ?? 0,
        ocp: ocp.get(m.id) ?? 0,
        unicorns: unis.get(m.id) ?? 0,
        wins: wins.get(m.id) ?? 0,
        draws: draws.get(m.id) ?? 0,
        form: form.get(m.id) ?? [],
    }));
    rows.sort((a, b) => b.mltPts - a.mltPts || b.unicorns - a.unicorns || b.ocp - a.ocp || a.name.localeCompare(b.name));
    return rows;
}
async function computeRelevantGwsWindow(supa, gwsWithResults, leagueStartGw, currentGw, outcomeByGwIdx) {
    const orderedGws = await orderCompletedGwsByFirstKickoff(supa, gwsWithResults);
    const startIdx = leagueStartGw <= 0
        ? 0
        : orderedGws.findIndex((gw) => gw === leagueStartGw);
    if (startIdx < 0)
        return [];
    // Workaround for bad legacy rows where a low numeric GW id has a later kickoff date
    // (e.g. this season has a `gw=2` fixture in November). Once a league starts at GW8,
    // those lower ids must not re-enter the mini-league window just because their kickoff is later.
    let relevantGws = orderedGws.slice(startIdx).filter((gw) => leagueStartGw <= 0 || gw >= leagueStartGw);
    if (relevantGws.includes(currentGw)) {
        const { data: fixturesForCurrentGw } = await supa.from('app_fixtures').select('fixture_index').eq('gw', currentGw);
        const fixtureCount = fixturesForCurrentGw?.length ?? 0;
        const resultCountForCurrentGw = Array.from(outcomeByGwIdx.keys()).filter((k) => parseInt(k.split(':')[0], 10) === currentGw).length;
        if (fixtureCount > 0 && resultCountForCurrentGw < fixtureCount) {
            relevantGws = relevantGws.filter((gw) => gw !== currentGw);
        }
    }
    return relevantGws;
}
/** PostgREST page size for per-member `range()` paging only (not a scoring cap). */
const APP_PICKS_PAGE_SIZE = 1000;
/**
 * All `app_picks` for the given members and gameweeks — one **paginated** query per member.
 */
async function fetchAllAppPicksForMiniLeagueSeason(supa, memberIds, relevantGws) {
    if (relevantGws.length === 0 || memberIds.length === 0)
        return [];
    const chunks = await Promise.all(memberIds.map(async (uid) => {
        const out = [];
        for (let offset = 0;; offset += APP_PICKS_PAGE_SIZE) {
            const { data, error } = await supa
                .from('app_picks')
                .select('user_id,gw,fixture_index,pick,created_at')
                .eq('user_id', uid)
                .in('gw', relevantGws)
                .order('gw', { ascending: true })
                .order('fixture_index', { ascending: true })
                .range(offset, offset + APP_PICKS_PAGE_SIZE - 1);
            if (error)
                throw error;
            const batch = data ?? [];
            out.push(...batch);
            if (batch.length < APP_PICKS_PAGE_SIZE)
                break;
        }
        return out;
    }));
    return chunks.flat();
}
