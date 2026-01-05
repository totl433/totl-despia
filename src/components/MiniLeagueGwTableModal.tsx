import { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import ResultsTable from './league/ResultsTable';
import WinnerBanner from './league/WinnerBanner';
import { useGameweekState } from '../hooks/useGameweekState';
import { useLiveScores } from '../hooks/useLiveScores';
import type { Fixture } from './FixtureCard';

export interface MiniLeagueGwTableModalProps {
 isOpen: boolean;
 onClose: () => void;
 leagueId: string;
 leagueName: string;
 members: Array<{ id: string; name: string }>;
 currentUserId?: string;
 currentGw: number | null;
 // Optional mock data for Storybook/testing
 mockData?: {
 fixtures: Fixture[];
 picks: PickRow[];
 results: Array<{ gw: number; fixture_index: number; result: "H" | "D" | "A" | null }>;
 displayGw: number;
 isLive?: boolean; // Flag to indicate if this is a live GW for Storybook
 };
}

type ResultRow = {
 user_id: string;
 name: string;
 score: number;
 unicorns: number;
};

type PickRow = {
 user_id: string;
 gw: number;
 fixture_index: number;
 pick: "H" | "D" | "A";
};

function rowToOutcome(r: { result?: "H" | "D" | "A" | null }): "H" | "D" | "A" | null {
 return r.result === "H" || r.result === "D" || r.result === "A" ? r.result : null;
}

export default function MiniLeagueGwTableModal({
 isOpen,
 onClose,
 leagueId,
 leagueName,
 members,
 currentUserId,
 currentGw,
 mockData,
}: MiniLeagueGwTableModalProps) {
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);
 const [displayGw, setDisplayGw] = useState<number | null>(null);
 const [fixtures, setFixtures] = useState<Fixture[]>([]);
 const [picks, setPicks] = useState<PickRow[]>([]);
 const [results, setResults] = useState<Array<{ gw: number; fixture_index: number; result: "H" | "D" | "A" | null }>>([]);
 const [rows, setRows] = useState<ResultRow[]>([]);
 const [allFixturesFinished, setAllFixturesFinished] = useState(false);
 const [hasLiveFixtures, setHasLiveFixtures] = useState(false);
 const [hasStartingSoonFixtures, setHasStartingSoonFixtures] = useState(false);
 const [hasStartedFixtures, setHasStartedFixtures] = useState(false);

 // Determine which GW to display based on game state
 const { state: currentGwState } = useGameweekState(currentGw);
 
 // Get live scores for the display GW
 const { liveScores: liveScoresMap } = useLiveScores(displayGw ?? undefined, undefined);

 // Convert liveScoresMap to a Record keyed by fixture_index (same pattern as League.tsx)
 const liveScores = useMemo(() => {
 const result: Record<number, { homeScore: number; awayScore: number; status: string; minute?: number | null }> = {};
 if (!fixtures || fixtures.length === 0) return result;
 fixtures.forEach(fixture => {
 const apiMatchId = fixture.api_match_id;
 if (apiMatchId) {
 const liveScore = liveScoresMap.get(apiMatchId);
 if (liveScore) {
 result[fixture.fixture_index] = {
 homeScore: liveScore.home_score ?? 0,
 awayScore: liveScore.away_score ?? 0,
 status: liveScore.status || 'SCHEDULED',
 minute: liveScore.minute ?? null
 };
 }
 }
 });
 return result;
 }, [liveScoresMap, fixtures]);

 // Determine display GW: current if LIVE/RESULTS_PRE_GW, last completed if GW_OPEN/GW_PREDICTED
 // Or use mock data if provided
 useEffect(() => {
 if (mockData) {
 setDisplayGw(mockData.displayGw);
 setFixtures(mockData.fixtures);
 setPicks(mockData.picks);
 setResults(mockData.results);
 setLoading(false);
 return;
 }

 if (!isOpen || !currentGw) {
 setDisplayGw(null);
 return;
 }

 let alive = true;

 async function determineDisplayGw() {
 if (currentGwState === 'LIVE' || currentGwState === 'RESULTS_PRE_GW') {
 // Show current GW
 setDisplayGw(currentGw);
 return;
 }

 // For GW_OPEN or GW_PREDICTED, find last completed GW
 const { data: resultsData } = await supabase
 .from('app_gw_results')
 .select('gw')
 .order('gw', { ascending: false })
 .limit(1);

 if (!alive) return;

 const lastCompletedGw = resultsData && resultsData.length > 0 
 ? (resultsData[0] as any).gw 
 : null;

 setDisplayGw(lastCompletedGw || currentGw);
 }

 determineDisplayGw();

 return () => {
 alive = false;
 };
 }, [isOpen, currentGw, currentGwState, mockData]);

 // Fetch data when modal opens and displayGw is determined
 // Skip if using mock data (already set in previous effect)
 useEffect(() => {
 if (mockData) {
 return; // Mock data already set
 }

 if (!isOpen || !displayGw || !leagueId) {
 setLoading(false);
 return;
 }

 let alive = true;

 async function fetchData() {
 setLoading(true);
 setError(null);

 try {
 // Fetch fixtures for this GW
 const { data: fixturesData, error: fixturesError } = await supabase
 .from('app_fixtures')
 .select('id, gw, fixture_index, home_name, away_name, home_team, away_team, home_code, away_code, kickoff_time, api_match_id')
 .eq('gw', displayGw)
 .order('fixture_index', { ascending: true });

 if (fixturesError) throw fixturesError;
 if (!alive) return;

 setFixtures((fixturesData as Fixture[]) ?? []);

 // Fetch picks for all members for this GW
 const memberIds = members.map(m => m.id);
 const { data: picksData, error: picksError } = await supabase
 .from('app_picks')
 .select('user_id, gw, fixture_index, pick')
 .eq('gw', displayGw)
 .in('user_id', memberIds);

 if (picksError) throw picksError;
 if (!alive) return;

 setPicks((picksData ?? []) as PickRow[]);

 // Fetch results for this GW
 const { data: resultsData, error: resultsError } = await supabase
 .from('app_gw_results')
 .select('gw, fixture_index, result')
 .eq('gw', displayGw);

 if (resultsError) throw resultsError;
 if (!alive) return;

 setResults((resultsData ?? []) as Array<{ gw: number; fixture_index: number; result: "H" | "D" | "A" | null }>);

 setLoading(false);
 } catch (err: any) {
 console.error('[MiniLeagueGwTableModal] Error fetching data:', err);
 if (alive) {
 setError(err?.message || 'Failed to load data');
 setLoading(false);
 }
 }
 }

 fetchData();

 return () => {
 alive = false;
 };
 }, [isOpen, displayGw, leagueId, members]);

 // Calculate rows from picks and results/live scores
 useEffect(() => {
 if (!displayGw || fixtures.length === 0 || picks.length === 0) {
 setRows([]);
 return;
 }

 const outcomes = new Map<number, "H" | "D" | "A">();
 const fixturesForGw = fixtures.filter(f => f.gw === displayGw);

 // Check if GW is live
 const hasLiveScores = fixturesForGw.some((f) => {
 const liveScore = liveScores[f.fixture_index];
 return liveScore && (liveScore.status === 'IN_PLAY' || liveScore.status === 'PAUSED' || liveScore.status === 'FINISHED');
 });

 // Use live scores if GW is live and current, otherwise use results
 if (hasLiveScores && displayGw === currentGw) {
 fixturesForGw.forEach((f) => {
 const liveScore = liveScores[f.fixture_index];
 if (liveScore && (liveScore.status === 'IN_PLAY' || liveScore.status === 'PAUSED' || liveScore.status === 'FINISHED')) {
 if (liveScore.homeScore > liveScore.awayScore) {
 outcomes.set(f.fixture_index, 'H');
 } else if (liveScore.awayScore > liveScore.homeScore) {
 outcomes.set(f.fixture_index, 'A');
 } else {
 outcomes.set(f.fixture_index, 'D');
 }
 }
 });
 } else {
 // Use results
 results.forEach((r) => {
 if (r.gw !== displayGw) return;
 const out = rowToOutcome(r);
 if (out) outcomes.set(r.fixture_index, out);
 });
 }

 // Calculate scores
 const calculatedRows: ResultRow[] = members.map((m) => ({
 user_id: m.id,
 name: m.name,
 score: 0,
 unicorns: 0,
 }));

 const picksByFixture = new Map<number, Array<{ user_id: string; pick: "H" | "D" | "A" }>>();
 picks.forEach((p) => {
 if (p.gw !== displayGw) return;
 const arr = picksByFixture.get(p.fixture_index) ?? [];
 arr.push({ user_id: p.user_id, pick: p.pick });
 picksByFixture.set(p.fixture_index, arr);
 });

 Array.from(outcomes.entries()).forEach(([idx, out]) => {
 const these = picksByFixture.get(idx) ?? [];
 const correctIds = these.filter((p) => p.pick === out).map((p) => p.user_id);

 correctIds.forEach((uid) => {
 const r = calculatedRows.find((x) => x.user_id === uid);
 if (r) r.score += 1;
 });

 if (correctIds.length === 1 && members.length >= 3) {
 const r = calculatedRows.find((x) => x.user_id === correctIds[0]);
 if (r) r.unicorns += 1;
 }
 });

 calculatedRows.sort((a, b) => b.score - a.score || b.unicorns - a.unicorns || a.name.localeCompare(b.name));
 setRows(calculatedRows);

 // Check fixture status
 const allFinished = fixturesForGw.every((f) => {
 if (hasLiveScores && displayGw === currentGw) {
 const liveScore = liveScores[f.fixture_index];
 return liveScore?.status === 'FINISHED';
 }
 return outcomes.has(f.fixture_index);
 });

 const hasLive = fixturesForGw.some((f) => {
 const liveScore = liveScores[f.fixture_index];
 return liveScore && (liveScore.status === 'IN_PLAY' || liveScore.status === 'PAUSED');
 });

 const now = new Date();
 const hasStartingSoon = fixturesForGw.some((f) => {
 if (!f.kickoff_time) return false;
 const kickoffTime = new Date(f.kickoff_time);
 const timeUntilKickoff = kickoffTime.getTime() - now.getTime();
 const liveScore = liveScores[f.fixture_index];
 const hasNotStarted = !liveScore || (liveScore.status !== 'IN_PLAY' && liveScore.status !== 'PAUSED' && liveScore.status !== 'FINISHED');
 return hasNotStarted && timeUntilKickoff > 0 && timeUntilKickoff <= 24 * 60 * 60 * 1000;
 });

 const hasStarted = fixturesForGw.some((f) => {
 const liveScore = liveScores[f.fixture_index];
 return liveScore && (liveScore.status === 'IN_PLAY' || liveScore.status === 'PAUSED' || liveScore.status === 'FINISHED');
 });

 setAllFixturesFinished(allFinished);
 setHasLiveFixtures(hasLive);
 setHasStartingSoonFixtures(hasStartingSoon);
 setHasStartedFixtures(hasStarted);
 }, [displayGw, fixtures, picks, results, members, liveScores, currentGw]);

 // Close on escape key
 useEffect(() => {
 if (!isOpen) return;

 const handleEscape = (e: KeyboardEvent) => {
 if (e.key === 'Escape') {
 onClose();
 }
 };

 document.addEventListener('keydown', handleEscape);
 return () => document.removeEventListener('keydown', handleEscape);
 }, [isOpen, onClose]);

 // Prevent body scroll when open
 useEffect(() => {
 if (isOpen) {
 document.body.style.overflow = 'hidden';
 } else {
 document.body.style.overflow = '';
 }
 return () => {
 document.body.style.overflow = '';
 };
 }, [isOpen]);

 if (!isOpen) return null;

 // For mock data, use the isLive flag if provided, otherwise calculate from live fixtures
 const isLive = mockData?.isLive ?? (hasLiveFixtures && displayGw === currentGw);
 const isFinished = allFixturesFinished;
 const isDraw = rows.length > 1 && rows[0].score === rows[1]?.score && rows[0].unicorns === rows[1]?.unicorns;

 const content = (
 <>
 {/* Backdrop */}
 <div
 className="fixed inset-0 bg-black/60 backdrop-blur-sm"
 onClick={onClose}
 aria-hidden="true"
 style={{
 animation: 'fadeIn 200ms ease-out',
 zIndex: 999999,
 }}
 />

 {/* Modal */}
 <div
 className="fixed inset-0 flex items-center justify-center p-4 z-[1000000]"
 role="dialog"
 aria-modal="true"
 aria-labelledby="ml-gw-table-modal-title"
 onClick={(e) => {
 if (e.target === e.currentTarget) {
 onClose();
 }
 }}
 >
 <div
 className="relative max-w-2xl w-full max-h-[90vh] flex flex-col"
 onClick={(e) => e.stopPropagation()}
 >
 <div className="max-h-[90vh] overflow-y-auto bg-white rounded-3xl shadow-2xl">
 {loading ? (
 <div className="p-12 flex items-center justify-center">
 <div className="text-slate-500">Loading table...</div>
 </div>
 ) : error ? (
 <div className="p-12 flex items-center justify-center">
 <div className="text-red-500">{error}</div>
 </div>
 ) : !displayGw ? (
 <div className="p-12 flex items-center justify-center">
 <div className="text-slate-500">No gameweek available</div>
 </div>
 ) : (
 <div className="p-6">
 {/* Header */}
 <div className="mb-6 relative">
 <div className="flex items-start justify-between">
 <div className="flex-1">
 <h2 id="ml-gw-table-modal-title" className="text-2xl font-bold text-slate-900 mb-2">
 {leagueName}
 </h2>
 <div className="flex items-center gap-3">
 <span className="text-lg font-semibold text-slate-700">Gameweek {displayGw}</span>
 {isLive && (
 <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-600 text-white shadow-md shadow-red-500/30">
 <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
 <span className="text-xs font-semibold">LIVE</span>
 </div>
 )}
 </div>
 </div>
 {/* Volley playing image - flipped horizontally */}
 <img
 src="/assets/Volley/Volley-playing.png"
 alt="Volley"
 className="w-16 h-16 object-contain flex-shrink-0"
 style={{ transform: 'scaleX(-1)' }}
 />
 </div>
 </div>

 {/* Winner Banner - only show for completed GWs, not live ones */}
 {rows.length > 0 && isFinished && !isLive && (
 <div className="mb-4">
 <WinnerBanner 
 winnerName={rows[0].name} 
 isDraw={isDraw}
 />
 </div>
 )}

 {/* Table */}
 {rows.length > 0 ? (
 <ResultsTable
 rows={rows}
 members={members}
 currentUserId={currentUserId}
 positionChangeKeys={new Set()}
 isApiTestLeague={false}
 hasLiveFixtures={hasLiveFixtures}
 hasStartingSoonFixtures={hasStartingSoonFixtures}
 hasStartedFixtures={hasStartedFixtures}
 allFixturesFinished={allFixturesFinished}
 resGw={displayGw}
 />
 ) : (
 <div className="p-8 text-center text-slate-500">
 No results available for Gameweek {displayGw}
 </div>
 )}
 </div>
 )}
 </div>

 {/* Close button */}
 <div className="flex justify-end mt-4">
 <button
 onClick={onClose}
 className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10"
 aria-label="Close"
 >
 <svg
 className="w-6 h-6 text-white font-bold"
 fill="none"
 stroke="currentColor"
 strokeWidth={3}
 viewBox="0 0 24 24"
 >
 <path
 strokeLinecap="round"
 strokeLinejoin="round"
 d="M6 18L18 6M6 6l12 12"
 />
 </svg>
 </button>
 </div>
 </div>
 </div>
 </>
 );

 if (typeof document !== 'undefined' && document.body) {
 return createPortal(content, document.body);
 }

 return content;
}

