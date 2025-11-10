import { useEffect, useMemo, useRef, useState } from "react";
import type { TouchEventHandler } from "react";
import { useAuth } from "../context/AuthContext";
import ClubBadge from "../components/ClubBadge";
import { useNavigate } from "react-router-dom";

type Fixture = {
  id: string;
  gw: number;
  fixture_index: number;
  home_team: string;
  away_team: string;
  home_code?: string | null;
  away_code?: string | null;
  home_name?: string | null;
  away_name?: string | null;
  kickoff_time?: string | null;
};

type Pick = {
  fixture_index: number;
  pick: "H" | "D" | "A";
  gw: number;
};

type CardState = { x: number; y: number; rotation: number; opacity: number; scale: number };

const TEAM_COLORS: Record<string, { primary: string; secondary: string }> = {
  ARS: { primary: "#EF0107", secondary: "#023474" },
  AVL: { primary: "#95BFE5", secondary: "#670E36" },
  BOU: { primary: "#DA291C", secondary: "#000000" },
  BRE: { primary: "#E30613", secondary: "#FBB800" },
  BHA: { primary: "#0057B8", secondary: "#FFCD00" },
  CHE: { primary: "#034694", secondary: "#034694" },
  CRY: { primary: "#1B458F", secondary: "#C4122E" },
  EVE: { primary: "#003399", secondary: "#003399" },
  FUL: { primary: "#FFFFFF", secondary: "#000000" },
  LIV: { primary: "#C8102E", secondary: "#00B2A9" },
  MCI: { primary: "#6CABDD", secondary: "#1C2C5B" },
  MUN: { primary: "#DA291C", secondary: "#FBE122" },
  NEW: { primary: "#241F20", secondary: "#FFFFFF" },
  NFO: { primary: "#DD0000", secondary: "#FFFFFF" },
  TOT: { primary: "#132257", secondary: "#FFFFFF" },
  WHU: { primary: "#7A263A", secondary: "#1BB1E7" },
  WOL: { primary: "#FDB913", secondary: "#231F20" },
  SUN: { primary: "#EB172B", secondary: "#211E1F" },
  LEE: { primary: "#FFCD00", secondary: "#1D428A" },
};

export default function SwipePredictions() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [currentGw, setCurrentGw] = useState<number | null>(null);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [picks, setPicks] = useState<Map<number, Pick>>(new Map());
  const [results, setResults] = useState<Map<number, "H" | "D" | "A">>(new Map());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [viewMode, setViewMode] = useState<"cards" | "list">("cards" as const);
  const [cardState, setCardState] = useState<CardState>({ x: 0, y: 0, rotation: 0, opacity: 1, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showFeedback, setShowFeedback] = useState<"home" | "draw" | "away" | null>(null);
  const [returnToReview, setReturnToReview] = useState(false);
  const [confirmCelebration, setConfirmCelebration] = useState<{ success: boolean; message: string } | null>(null);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [viewMode]);

  const allPicksMade = useMemo(() => {
    if (fixtures.length === 0) return false;
    return fixtures.every(f => picks.has(f.fixture_index));
  }, [fixtures, picks]);

  const cardRef = useRef<HTMLDivElement>(null);
  const startPosRef = useRef({ x: 0, y: 0 });
  const isResettingRef = useRef(false);

  useEffect(() => {
    setCurrentGw(50);

    const baseKickoff = new Date(Date.UTC(2025, 3, 5, 11, 0, 0));
    const demoFixtures: Fixture[] = [
      { id: "gw50-1", gw: 50, fixture_index: 0, home_team: "Tottenham Hotspur", away_team: "Arsenal", home_code: "TOT", away_code: "ARS", home_name: "Tottenham", away_name: "Arsenal", kickoff_time: new Date(baseKickoff.getTime()).toISOString() },
      { id: "gw50-2", gw: 50, fixture_index: 1, home_team: "Chelsea", away_team: "Manchester City", home_code: "CHE", away_code: "MCI", home_name: "Chelsea", away_name: "Man City", kickoff_time: new Date(baseKickoff.getTime() + 2 * 60 * 60 * 1000).toISOString() },
      { id: "gw50-3", gw: 50, fixture_index: 2, home_team: "Liverpool", away_team: "Newcastle United", home_code: "LIV", away_code: "NEW", home_name: "Liverpool", away_name: "Newcastle", kickoff_time: new Date(baseKickoff.getTime() + 4 * 60 * 60 * 1000).toISOString() },
      { id: "gw50-4", gw: 50, fixture_index: 3, home_team: "Brighton & Hove Albion", away_team: "Manchester United", home_code: "BHA", away_code: "MUN", home_name: "Brighton", away_name: "Man United", kickoff_time: new Date(baseKickoff.getTime() + 6 * 60 * 60 * 1000).toISOString() },
      { id: "gw50-5", gw: 50, fixture_index: 4, home_team: "Aston Villa", away_team: "West Ham United", home_code: "AVL", away_code: "WHU", home_name: "Aston Villa", away_name: "West Ham", kickoff_time: new Date(baseKickoff.getTime() + 8 * 60 * 60 * 1000).toISOString() },
      { id: "gw50-6", gw: 50, fixture_index: 5, home_team: "Brentford", away_team: "Fulham", home_code: "BRE", away_code: "FUL", home_name: "Brentford", away_name: "Fulham", kickoff_time: new Date(baseKickoff.getTime() + 24 * 60 * 60 * 1000).toISOString() },
      { id: "gw50-7", gw: 50, fixture_index: 6, home_team: "Crystal Palace", away_team: "Everton", home_code: "CRY", away_code: "EVE", home_name: "Crystal Palace", away_name: "Everton", kickoff_time: new Date(baseKickoff.getTime() + 26 * 60 * 60 * 1000).toISOString() },
      { id: "gw50-8", gw: 50, fixture_index: 7, home_team: "Nottingham Forest", away_team: "Wolverhampton Wanderers", home_code: "NFO", away_code: "WOL", home_name: "Nott'm Forest", away_name: "Wolves", kickoff_time: new Date(baseKickoff.getTime() + 28 * 60 * 60 * 1000).toISOString() },
      { id: "gw50-9", gw: 50, fixture_index: 8, home_team: "Bournemouth", away_team: "Leeds United", home_code: "BOU", away_code: "LEE", home_name: "Bournemouth", away_name: "Leeds", kickoff_time: new Date(baseKickoff.getTime() + 30 * 60 * 60 * 1000).toISOString() },
      { id: "gw50-10", gw: 50, fixture_index: 9, home_team: "Sunderland", away_team: "Burnley", home_code: "SUN", away_code: "BUR", home_name: "Sunderland", away_name: "Burnley", kickoff_time: new Date(baseKickoff.getTime() + 32 * 60 * 60 * 1000).toISOString() },
    ];

    setFixtures(demoFixtures);
    setPicks(new Map());
    setResults(new Map());
  }, []);

  useEffect(() => {
    if (fixtures.length > 0 && user?.id) {
      const allMade = fixtures.every(f => picks.has(f.fixture_index));
      setViewMode(allMade ? "list" : "cards");
    } else {
      setViewMode("cards");
    }
  }, [fixtures, picks, user?.id]);

  const currentFixture = fixtures[currentIndex];

  const myScore = useMemo(() => {
    let score = 0;
    fixtures.forEach(f => {
      const r = results.get(f.fixture_index);
      const p = picks.get(f.fixture_index);
      if (r && p && p.pick === r) score += 1;
    });
    return score;
  }, [fixtures, results, picks]);

  const handleStart = (clientX: number, clientY: number) => {
    if (isAnimating) return;
    setIsDragging(true);
    startPosRef.current = { x: clientX, y: clientY };
    setShowFeedback(null);
  };
  const handleMove = (clientX: number, clientY: number) => {
    if (!isDragging || isAnimating) return;
    const deltaX = clientX - startPosRef.current.x;
    const deltaY = clientY - startPosRef.current.y;
    const rotation = deltaX * 0.1;
    setCardState({ x: deltaX, y: deltaY, rotation, opacity: 1, scale: 1 });
    if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY)) {
      setShowFeedback(deltaX > 0 ? "away" : "home");
    } else if (deltaY > 50 && deltaY > Math.abs(deltaX)) {
      setShowFeedback("draw");
    } else {
      setShowFeedback(null);
    }
  };
  const handleEnd = () => {
    if (!isDragging || isAnimating) return;
    setIsDragging(false);
    const { x, y } = cardState;
    const threshold = 100;
    let pick: "H" | "D" | "A" | null = null;
    if (Math.abs(x) > threshold && Math.abs(x) > Math.abs(y)) pick = x > 0 ? "A" : "H";
    else if (y > threshold && y > Math.abs(x)) pick = "D";
    if (pick) animateCardOut(pick);
    else { setCardState({ x: 0, y: 0, rotation: 0, opacity: 1, scale: 1 }); setShowFeedback(null); }
  };

  const handleTouchStart: TouchEventHandler<HTMLDivElement> = (e) => {
    if (e.touches.length !== 1) return;
    handleStart(e.touches[0].clientX, e.touches[0].clientY);
  };

  const handleTouchMove: TouchEventHandler<HTMLDivElement> = (e) => {
    if (e.touches.length !== 1) return;
    if (!isDragging) return;
    e.preventDefault();
    handleMove(e.touches[0].clientX, e.touches[0].clientY);
  };

  const handleTouchEnd: TouchEventHandler<HTMLDivElement> = (e) => {
    if (e.touches.length > 0) return;
    e.preventDefault();
    handleEnd();
  };

  const animateCardOut = async (pick: "H" | "D" | "A") => {
    setIsAnimating(true);
    setShowFeedback(null);
    const direction = pick === "H" ? -1 : pick === "A" ? 1 : 0;
    const targetX = direction * window.innerWidth;
    const targetY = pick === "D" ? window.innerHeight : 0;
    setCardState({ x: targetX, y: targetY, rotation: direction * 30, opacity: 0, scale: 0.8 });
    await savePick(pick);
    setTimeout(() => {
      isResettingRef.current = true;
      if (returnToReview) { setCurrentIndex(fixtures.length); setReturnToReview(false); }
      else { setCurrentIndex(currentIndex + 1); }
      setCardState({ x: 0, y: 0, rotation: 0, opacity: 1, scale: 1 });
      requestAnimationFrame(() => { isResettingRef.current = false; setIsAnimating(false); });
    }, 300);
  };
  const handleButtonClick = (pick: "H" | "D" | "A") => { if (!isAnimating) animateCardOut(pick); };
  const savePick = async (pick: "H" | "D" | "A") => {
    if (!currentFixture) return;
    setPicks(new Map(picks.set(currentFixture.fixture_index, { fixture_index: currentFixture.fixture_index, pick, gw: currentGw! })));
  };
  const handleConfirmClick = () => {
    if (!allPicksMade) {
      setConfirmCelebration({ success: false, message: "You still have fixtures to call!" });
      setTimeout(() => setConfirmCelebration(null), 2200);
      return;
    }
    setConfirmCelebration({ success: true, message: "Your predictions are locked in. Good luck!" });
    setTimeout(() => {
      setConfirmCelebration(null);
      navigate("/predictions");
    }, 2500);
  };

  if (!currentGw || fixtures.length === 0) {
    return (<div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center"><div className="text-slate-600">Loading fixtures...</div></div>);
  }

  if (currentIndex >= fixtures.length) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col">
        {confirmCelebration && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="relative overflow-hidden rounded-3xl bg-white px-10 py-8 text-center shadow-2xl max-w-sm mx-4">
              <div className="absolute -top-16 -left-10 h-32 w-32 rounded-full bg-emerald-200/40 blur-2xl" />
              <div className="absolute -bottom-14 -right-12 h-32 w-32 rounded-full bg-cyan-200/40 blur-2xl" />
              <div className="relative z-10 space-y-4">
                <div className="text-5xl">{confirmCelebration.success ? "🎉" : "📝"}</div>
                <div className={`text-2xl font-extrabold ${confirmCelebration.success ? "text-emerald-700" : "text-amber-600"}`}>
                  {confirmCelebration.success ? "Good Luck!" : "Not Quite Yet!"}
                </div>
                <p className="text-sm text-slate-600">{confirmCelebration.message}</p>
              </div>
            </div>
          </div>
        )}
        <div className="p-4">
          <div className="max-w-2xl mx-auto">
            <div className="relative flex items-center justify-between">
              <button
                onClick={() => setCurrentIndex(0)}
                className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-800"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>
              <span className="absolute left-1/2 -translate-x-1/2 text-lg font-extrabold text-slate-700">Review Mode</span>
              {allPicksMade ? (
                <button
                  onClick={handleConfirmClick}
                  className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-white shadow hover:bg-emerald-600"
                >
                  Confirm
                </button>
              ) : (
                picks.size > 0 ? (
                  <button
                    onClick={handleConfirmClick}
                    className="inline-flex items-center gap-2 rounded-full bg-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500 shadow-inner"
                  >
                    Confirm
                  </button>
                ) : (
                  <button
                    onClick={() => setCurrentIndex(0)}
                    className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 via-emerald-600 to-emerald-700 px-3 py-1.5 text-xs font-semibold text-white shadow-md transition hover:shadow-lg hover:from-emerald-600 hover:via-emerald-700 hover:to-emerald-800"
                  >
                    Swipe View
                  </button>
                )
              )}
            </div>
            <div className="mt-4 flex items-center justify-center">
              <div className="relative rounded-3xl border border-emerald-100 bg-white px-5 py-3 shadow-sm max-w-md w-full flex items-center gap-3 text-left">
                <div className="flex h-8 w-8 items-center justify-center text-emerald-700">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="text-sm text-slate-600">
                  Need to tweak something? Tap a prediction to adjust it. Everything locks in once you hit confirm.
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 pb-4">
          <div className="max-w-2xl mx-auto space-y-6">
            {(() => {
              const grouped: Array<{ label: string; items: typeof fixtures }>=[];
              let currentDate=''; let currentGroup: typeof fixtures = [];
              fixtures.forEach((fixture)=>{
                const fixtureDate = fixture.kickoff_time ? new Date(fixture.kickoff_time).toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'}) : 'No date';
                if (fixtureDate!==currentDate){ if(currentGroup.length>0){ grouped.push({label:currentDate,items:currentGroup}); } currentDate=fixtureDate; currentGroup=[fixture]; } else { currentGroup.push(fixture); }
              });
              if(currentGroup.length>0){ grouped.push({label:currentDate,items:currentGroup}); }
              return grouped.map((group,groupIdx)=>(
                <div key={groupIdx}>
                  <div className="text-lg font-semibold text-slate-800 mb-4">{group.label}</div>
                  <div className="space-y-4">
                    {group.items.map((fixture)=>{
                      const pick = picks.get(fixture.fixture_index);
                      return (
                        <div key={fixture.id} className="bg-white rounded-xl shadow-sm p-6">
                          <div className="flex items-center justify-between gap-2 mb-4">
                            <div className="flex-1 min-w-0 text-right"><span className="text-sm font-semibold text-slate-800 truncate inline-block">{fixture.home_name || fixture.home_team}</span></div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <ClubBadge code={fixture.home_code || ""} size={28} />
                              <div className="text-slate-400 font-medium text-sm">{fixture.kickoff_time ? new Date(fixture.kickoff_time).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}) : ''}</div>
                              <ClubBadge code={fixture.away_code || ""} size={28} />
                            </div>
                            <div className="flex-1 min-w-0 text-left"><span className="text-sm font-semibold text-slate-800 truncate inline-block">{fixture.away_name || fixture.away_team}</span></div>
                          </div>
                          <div className="grid grid-cols-3 gap-3">
                            <button onClick={()=>{const np=new Map(picks);np.set(fixture.fixture_index,{fixture_index:fixture.fixture_index,pick:"H",gw:currentGw!});setPicks(np);}} className={`h-16 rounded-xl border text-sm font-medium transition-colors flex items-center justify-center ${pick?.pick==="H"?"bg-emerald-600 text-white border-emerald-600":"bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"}`}>Home Win</button>
                            <button onClick={()=>{const np=new Map(picks);np.set(fixture.fixture_index,{fixture_index:fixture.fixture_index,pick:"D",gw:currentGw!});setPicks(np);}} className={`h-16 rounded-xl border text-sm font-medium transition-colors flex items-center justify-center ${pick?.pick==="D"?"bg-emerald-600 text-white border-emerald-600":"bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"}`}>Draw</button>
                            <button onClick={()=>{const np=new Map(picks);np.set(fixture.fixture_index,{fixture_index:fixture.fixture_index,pick:"A",gw:currentGw!});setPicks(np);}} className={`h-16 rounded-xl border text-sm font-medium transition-colors flex items-center justify-center ${pick?.pick==="A"?"bg-emerald-600 text-white border-emerald-600":"bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"}`}>Away Win</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>
        <div className="p-6 bg-white shadow-lg">
          <div className="max-w-2xl mx-auto space-y-4">
            {fixtures.length>0 && fixtures[0].kickoff_time && (
              <div className="rounded-2xl border border-emerald-200 bg-white px-4 py-3 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-700">
                  <span className="text-lg">⏱️</span>
                  <span className="text-sm font-semibold">Deadline</span>
                </div>
                <div className="text-right">
                  <div className="text-base font-bold text-emerald-900">
                    {new Date(new Date(fixtures[0].kickoff_time).getTime() - (75*60*1000)).toLocaleString('en-GB',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}
                  </div>
                  <div className="text-[11px] font-medium text-emerald-600">75 mins before first kickoff</div>
                </div>
              </div>
            )}
            {!allPicksMade && (<div className="text-center text-sm text-amber-600 mb-2">⚠️ You haven't made all your predictions yet</div>)}
            <div className="grid gap-3">
              <button onClick={handleConfirmClick} className="w-full py-4 bg-green-600 text-white rounded-2xl font-bold hover:bg-green-700 transition-colors">{allPicksMade?"Confirm Predictions":"Complete All Predictions First"}</button>
              <button onClick={()=>navigate("/predictions")} className="w-full py-3 text-slate-600 hover:text-slate-800 font-medium">Cancel</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col">
      {viewMode === "cards" && (
        <div className="p-4">
          <div className="max-w-md mx-auto">
            <div className="relative flex items-center justify-between mb-4">
              <button onClick={()=>navigate("/predictions")} className="text-slate-600 hover:text-slate-800">✕</button>
              <span className="absolute left-1/2 -translate-x-1/2 text-lg font-extrabold text-slate-700">Gameweek {currentGw}</span>
              {viewMode === "cards" && (
                <button
                  onClick={() => setCurrentIndex(fixtures.length)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-500 via-emerald-600 to-emerald-700 px-3 py-1.5 text-xs font-semibold text-white shadow-md transition hover:shadow-lg hover:from-emerald-600 hover:via-emerald-700 hover:to-emerald-800"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                  List View
                </button>
              )}
            </div>
            {viewMode === "cards" && (
              <div className="mt-4 flex justify-center">
                <div className="inline-flex items-center gap-2 rounded-full bg-[#e6f3f0] px-3 py-2">
                  {fixtures.map((_, idx) => {
                    const isComplete = idx < currentIndex;
                    const isCurrent = idx === currentIndex;
                    return (
                      <div
                        key={idx}
                        className={`flex items-center justify-center transition-all ${isCurrent ? "h-2 w-6 rounded-full bg-[#178f72]" : "h-3 w-3 rounded-full"} ${isComplete && !isCurrent ? "bg-[#116f59]" : !isCurrent ? "bg-white" : ""}`}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {viewMode === "list" ? (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-4 py-4">
            <div className="relative flex items-center justify-center">
              <button onClick={()=>navigate('/')} className="absolute left-0 top-0 w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-800 transition-colors"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
              <div className="text-center"><h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 mt-0 mb-2">Predictions Centre</h1><div className="mt-0 mb-4 text-base text-slate-500">Call every game, lock in your results,<br />and climb the table.</div></div>
            </div>
            <div className="mt-2 mb-3"><div className="rounded-xl border bg-slate-100 border-slate-200 px-6 py-4"><div className="text-center"><div className="font-semibold text-slate-800">GW{currentGw ? currentGw + 1 : 9} Coming Soon</div><div className="text-sm text-slate-600">Fixtures will be published soon.</div></div></div></div>
            <div className="mt-2 mb-4"><div className="rounded-xl border bg-gradient-to-r from-emerald-50 to-blue-50 border-emerald-200 px-6 py-4"><div className="flex items-center justify-between"><div><div className="text-emerald-900 font-semibold text-lg">GW {currentGw} Complete</div><div className="text-emerald-900 text-sm font-bold mt-1">Your Score</div></div><div className="text-emerald-900 text-5xl font-extrabold">{myScore}</div></div></div></div>
            {/* results list reused from above review rendering */}
          </div>
        </div>
      ) : (
        <div className="flex flex-col flex-1">
          <div className="flex items-center justify-center px-4 pt-4 pb-2 relative overflow-hidden" style={{ minHeight: 0 }}>
            <div className={`absolute left-8 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2 transition-opacity z-50 ${showFeedback === "home" ? "opacity-100" : "opacity-0"}`}><div className="text-6xl font-bold text-slate-700">←</div><div className="text-lg font-bold text-slate-700 bg-white px-4 py-2 rounded-full shadow-lg whitespace-nowrap">Home Win</div></div>
            <div className={`absolute right-8 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2 transition-opacity z-50 ${showFeedback === "away" ? "opacity-100" : "opacity-0"}`}><div className="text-6xl font-bold text-slate-700">→</div><div className="text-lg font-bold text-slate-700 bg-white px-4 py-2 rounded-full shadow-lg whitespace-nowrap">Away Win</div></div>
            <div className={`absolute bottom-32 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 transition-opacity z-50 ${showFeedback === "draw" ? "opacity-100" : "opacity-0"}`}><div className="text-6xl font-bold text-slate-700">↓</div><div className="text-lg font-bold text-slate-700 bg-white px-4 py-2 rounded-full shadow-lg">Draw</div></div>
            <div className="max-w-md w-full relative" style={{ aspectRatio: '0.75' }}>
              {currentIndex < fixtures.length - 1 && (() => {
                const nextFixture = fixtures[currentIndex + 1];
                return (
                  <div key={currentIndex + 1} className="absolute inset-0 pointer-events-none" style={{ transform: `scale(1)`, opacity: (isDragging || isAnimating) ? 0.5 : 0, zIndex: 1, transition: 'opacity 0.15s ease-out' }}>
                    <div className="bg-white rounded-3xl shadow-2xl overflow-hidden select-none">
                      <div className="p-8">
                        {nextFixture.kickoff_time && (<div className="text-center mb-6"><div className="text-sm text-slate-500 font-medium">{new Date(nextFixture.kickoff_time).toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})}</div></div>)}
                        <div className="flex items-center justify-center gap-4 mb-6">
                          <div className="flex flex-col items-center"><ClubBadge code={nextFixture.home_code || ""} size={120} /><div className="text-sm font-bold text-slate-700 mt-4 text-center max-w-[120px]">{nextFixture.home_name || nextFixture.home_team}</div></div>
                          <div className="flex flex-col items-center mb-8">{nextFixture.kickoff_time && (<div className="text-sm text-slate-700">{new Date(nextFixture.kickoff_time).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</div>)}</div>
                          <div className="flex flex-col items-center"><ClubBadge code={nextFixture.away_code || ""} size={120} /><div className="text-sm font-bold text-slate-700 mt-4 text-center max-w-[120px]">{nextFixture.away_name || nextFixture.away_team}</div></div>
                        </div>
                      </div>
                      <div className="h-48 relative overflow-hidden">
                        <div style={{ position: 'absolute', inset: 0, background: TEAM_COLORS[nextFixture.home_code || '']?.primary || '#94a3b8', clipPath: 'polygon(0 0, 0 100%, 100% 100%)' }} />
                        <div style={{ position: 'absolute', inset: 0, background: TEAM_COLORS[nextFixture.away_code || '']?.primary || '#94a3b8', clipPath: 'polygon(0 0, 100% 0, 100% 100%)' }} />
                      </div>
                    </div>
                  </div>
                );
              })()}
              <div
                ref={cardRef}
                className="absolute inset-0 z-10 cursor-grab active:cursor-grabbing"
                style={{ transform: `translate(${cardState.x}px, ${cardState.y}px) rotate(${cardState.rotation}deg) scale(${cardState.scale})`, opacity: cardState.opacity, transition: (isDragging || isResettingRef.current) ? "none" : "all 0.3s ease-out", touchAction: "none" }}
                onMouseDown={(e)=>handleStart(e.clientX,e.clientY)} onMouseMove={(e)=>handleMove(e.clientX,e.clientY)} onMouseUp={handleEnd} onMouseLeave={handleEnd}
                onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
              >
                <div className="bg-white rounded-3xl shadow-2xl overflow-hidden select-none">
                  <div className="p-8 relative pointer-events-none">
                    <div className="absolute top-4 right-4 flex items-center gap-2 text-slate-400 text-xs font-semibold">
                      <img
                        src="https://cdn-icons-png.flaticon.com/512/4603/4603384.png"
                        alt="Swipe gesture icon"
                        className="w-6 h-6 opacity-80"
                      />
                    </div>
                    {currentFixture.kickoff_time && (<div className="text-center mb-6"><div className="text-sm text-slate-500 font-medium">{new Date(currentFixture.kickoff_time).toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})}</div></div>)}
                    <div className="flex items-center justify-center gap-4 mb-6">
                      <div className="flex flex-col items-center"><ClubBadge code={currentFixture.home_code || ""} size={120} /><div className="text-sm font-bold text-slate-700 mt-4 text-center max-w-[120px]">{currentFixture.home_name || currentFixture.home_team}</div></div>
                      <div className="flex flex-col items-center mb-8">{currentFixture.kickoff_time && (<div className="text-sm text-slate-700">{new Date(currentFixture.kickoff_time).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</div>)}</div>
                      <div className="flex flex-col items-center"><ClubBadge code={currentFixture.away_code || ""} size={120} /><div className="text-sm font-bold text-slate-700 mt-4 text-center max-w-[120px]">{currentFixture.away_name || currentFixture.away_team}</div></div>
                    </div>
                    {(() => {
                      const fixtureResult = results.get(currentFixture.fixture_index);
                      const userPick = picks.get(currentFixture.fixture_index);
                      if (fixtureResult && userPick) {
                        const isCorrect = userPick.pick === fixtureResult;
                        return (
                          <div className="text-center mb-4 space-y-2">
                            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-full text-sm font-semibold"><span>🎯</span><span>Result: {fixtureResult === "H" ? "Home Win" : fixtureResult === "A" ? "Away Win" : "Draw"}</span></div>
                            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold ${isCorrect?"bg-green-50 text-green-700":"bg-red-50 text-red-700"}`}><span>{isCorrect?"✓":"✗"}</span><span>Your pick: {userPick.pick === "H" ? "Home Win" : userPick.pick === "A" ? "Away Win" : "Draw"}{isCorrect?" (Correct!)":" (Incorrect)"}</span></div>
                          </div>
                        );
                      } else if (userPick) {
                        return (<div className="text-center mb-4"><div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-50 text-gray-700 rounded-full text-sm font-semibold"><span>⏳</span><span>Your pick: {userPick.pick === "H" ? "Home Win" : userPick.pick === "A" ? "Away Win" : "Draw"} (Result pending)</span></div></div>);
                      }
                      return null;
                    })()}
                  </div>
                  <div className="h-48 relative overflow-hidden">
                    <div className="absolute inset-0" style={{ background: TEAM_COLORS[currentFixture.home_code || '']?.primary || '#94a3b8', clipPath: 'polygon(0 0, 0 100%, 100% 100%)' }} />
                    <div className="absolute inset-0" style={{ background: TEAM_COLORS[currentFixture.away_code || '']?.primary || '#94a3b8', clipPath: 'polygon(0 0, 100% 0, 100% 100%)' }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="px-4 pt-6 pb-8 bg-[#eef4f3]">
            <div className="max-w-md mx-auto">
              <div className="flex items-stretch justify-center gap-3">
                <button
                  onClick={()=>handleButtonClick("H")}
                  disabled={isAnimating}
                  className="flex-1 py-4 rounded-2xl font-semibold transition-all flex items-center justify-center bg-[#d7e6e3] text-slate-700 disabled:opacity-70"
                  style={{ backgroundColor: cardState.x < -30 ? `rgba(34, 197, 94, ${Math.min(0.8, Math.abs(cardState.x) / 150)})` : undefined, color: cardState.x < -30 ? '#fff' : undefined }}
                >
                  Home Win
                </button>
                <button
                  onClick={()=>handleButtonClick("D")}
                  disabled={isAnimating}
                  className="flex-1 py-4 rounded-2xl font-semibold transition-all flex items-center justify-center bg-[#d7e6e3] text-slate-700 disabled:opacity-70"
                  style={{ backgroundColor: cardState.y > 30 ? `rgba(59, 130, 246, ${Math.min(0.8, cardState.y / 150)})` : undefined, color: cardState.y > 30 ? '#fff' : undefined }}
                >
                  Draw
                </button>
                <button
                  onClick={()=>handleButtonClick("A")}
                  disabled={isAnimating}
                  className="flex-1 py-4 rounded-2xl font-semibold transition-all flex items-center justify-center bg-[#d7e6e3] text-slate-700 disabled:opacity-70"
                  style={{ backgroundColor: cardState.x > 30 ? `rgba(34, 197, 94, ${Math.min(0.8, cardState.x / 150)})` : undefined, color: cardState.x > 30 ? '#fff' : undefined }}
                >
                  Away Win
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}