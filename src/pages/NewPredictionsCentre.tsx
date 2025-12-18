import { useEffect, useState, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import { getMediumName } from "../lib/teamNames";
import { useLiveScores } from "../hooks/useLiveScores";
import { PageHeader } from "../components/PageHeader";

function sideName(f: any, side: "home" | "away") {
  const nm = f?.[`${side}_name`];
  const team = f?.[`${side}_team`];
  const code = f?.[`${side}_code`];
  const key = code || nm || team || "";
  const resolved = getMediumName(key);
  return resolved || (side === "home" ? "Home" : "Away");
}

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

type PickRow = {
  gw: number;
  fixture_index: number;
  pick: "H" | "D" | "A";
};

type ResultRow = {
  gw: number;
  fixture_index: number;
  result: "H" | "D" | "A" | null;
};

export default function NewPredictionsCentre() {
  const { user } = useAuth();
  
  const [currentGw, setCurrentGw] = useState<number | null>(null);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [picks, setPicks] = useState<Map<number, Pick>>(new Map());
  const [results, setResults] = useState<Map<number, "H" | "D" | "A">>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [submitted, setSubmitted] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successModalType, setSuccessModalType] = useState<'saved' | 'confirmed'>('saved');
  const [isPastDeadline, setIsPastDeadline] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [topPercent, setTopPercent] = useState<number | null>(null);
  const [isInApiTestLeague, setIsInApiTestLeague] = useState(false);

  // Get api_match_ids from fixtures for real-time subscription
  const apiMatchIds = useMemo(() => {
    return fixtures
      .map(f => (f as any).api_match_id)
      .filter((id): id is number => id !== null && id !== undefined);
  }, [fixtures]);

  // Subscribe to real-time live scores updates
  const { liveScores: liveScoresMap } = useLiveScores(currentGw || undefined, apiMatchIds.length > 0 ? apiMatchIds : undefined);

  // Debug: Log when isPastDeadline changes
  useEffect(() => {
    console.log('isPastDeadline state changed to:', isPastDeadline);
  }, [isPastDeadline]);

  // Calculate score when results or picks change
  useEffect(() => {
    if (results.size > 0 && picks.size > 0) {
      let correct = 0;
      picks.forEach((pick) => {
        const result = results.get(pick.fixture_index);
        if (result && result === pick.pick) {
          correct++;
        }
      });
      setScore(correct);
      console.log('Calculated score:', correct);
      
      // Calculate top percentage
      (async () => {
        if (currentGw) {
          // Get all users' picks for this GW
          // All users now read from app_picks (App tables)
          const picksTable = "app_picks";
          const { data: allPicks } = await supabase
            .from(picksTable)
            .select("user_id, fixture_index, pick")
            .eq("gw", currentGw);
          
          if (allPicks) {
            // Group picks by user and calculate each user's score
            const userScores = new Map<string, number>();
            allPicks.forEach((p) => {
              const result = results.get(p.fixture_index);
              const userScore = userScores.get(p.user_id) || 0;
              if (result && result === p.pick) {
                userScores.set(p.user_id, userScore + 1);
              } else {
                userScores.set(p.user_id, userScore);
              }
            });
            
            // Convert to array and sort descending
            const scores = Array.from(userScores.values()).sort((a, b) => b - a);
            
            // Calculate what percentage of users scored the same or less
            const betterOrEqual = scores.filter(s => s >= correct).length;
            const totalUsers = scores.length;
            const percent = Math.round((betterOrEqual / totalUsers) * 100);
            
            setTopPercent(percent);
            console.log('Top percent:', percent);
          }
        }
      })();
    }
  }, [results, picks, currentGw]);

  // Load current gameweek data from database
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // Check if user is in API Test league
        let apiTestLeague = false;
        if (user?.id) {
          try {
            // First get all user's leagues
            const { data: userLeagues, error: leaguesError } = await supabase
              .from("league_members")
              .select("leagues(id,name)")
              .eq("user_id", user.id);
            
            // If error, log but don't fail - just don't use test fixtures
            if (leaguesError) {
              console.warn('[NewPredictionsCentre] Error checking leagues (non-fatal):', leaguesError);
              apiTestLeague = false;
            } else if (userLeagues) {
              // Check if any league has name "API Test"
              apiTestLeague = userLeagues.some((row: any) => row.leagues?.name === "API Test");
            }
          } catch (error: any) {
            console.error('[NewPredictionsCentre] Error checking API Test membership:', error);
            // If check fails, default to false (don't use test fixtures)
            apiTestLeague = false;
          }
        }
        if (alive) setIsInApiTestLeague(apiTestLeague);
        
        // Fetch current gameweek from app_meta table (App uses app_meta)
        const { data: meta, error: metaError } = await supabase
          .from("app_meta")
          .select("current_gw")
          .eq("id", 1)
          .maybeSingle();
        
        if (metaError) {
          console.error('[NewPredictionsCentre] Error fetching current GW from app_meta:', metaError);
          // Default to GW 1 if we can't fetch
          if (alive) {
            setError(`Failed to load gameweek: ${metaError.message || 'Unknown error'}`);
            setLoading(false);
          }
          return;
        }
        
        const currentGw = (meta as any)?.current_gw ?? 1;
        
        // All users now read fixtures from app_fixtures (App tables)
        // This includes both App users and Web users (after mirroring)
        let fx;
        let gwToDisplay = currentGw;
        
        fx = await supabase
          .from("app_fixtures")
          .select(
            "id,gw,fixture_index,home_name,away_name,home_team,away_team,home_code,away_code,kickoff_time,api_match_id"
          )
          .eq("gw", currentGw)
          .order("fixture_index", { ascending: true });
        
        const { data: fxData, error: fxErr } = fx;

        if (fxErr) {
          console.error('Error fetching fixtures:', fxErr);
          if (alive) {
            setLoading(false);
            setError(`Failed to load fixtures: ${fxErr.message || 'Unknown error'}`);
          }
          return;
        }

        const realFixtures: Fixture[] = (fxData as Fixture[]) ?? [];
        if (alive) {
          setFixtures(realFixtures);
          setCurrentGw(gwToDisplay); // Set to 1 if showing test fixtures, otherwise currentGw
          console.log('Loaded', realFixtures.length, 'fixtures for GW', gwToDisplay, apiTestLeague && gwToDisplay === 1 ? '(Test GW 1)' : '');
          
          // Check if we're past the deadline
          if (realFixtures.length > 0 && realFixtures[0].kickoff_time) {
            // Find the earliest kickoff time
            const earliestKickoff = realFixtures.reduce((earliest, fixture) => {
              if (!fixture.kickoff_time) return earliest;
              const fixtureTime = new Date(fixture.kickoff_time);
              return !earliest || fixtureTime < earliest ? fixtureTime : earliest;
            }, null as Date | null);
            
            if (earliestKickoff) {
              // Calculate the deadline as 75 minutes before the earliest kickoff
              const deadlineTime = new Date(earliestKickoff.getTime() - (75 * 60 * 1000));
              const now = new Date();
              
              const isPastDeadline = now.getTime() > deadlineTime.getTime();
              
              console.log('Earliest kickoff:', earliestKickoff.toISOString());
              console.log('Deadline time:', deadlineTime.toISOString());
              console.log('Current time:', now.toISOString());
              console.log('Is past deadline?', isPastDeadline);
              
              setIsPastDeadline(isPastDeadline);
            }
          }
        }

        // Fetch user's picks for the gameweek being displayed
        // All users now read from app_picks (App tables)
        const picksGw = currentGw;
        if (user?.id) {
          const picksTable = "app_picks";
          const { data: pk, error: pkErr } = await supabase
            .from(picksTable)
            .select("gw,fixture_index,pick")
            .eq("gw", picksGw)
            .eq("user_id", user.id);

          if (pkErr) {
            console.error('Error fetching picks:', pkErr);
            // Don't return - continue without picks
          }

          const picksMap = new Map<number, Pick>();
          (pk as PickRow[] | null)?.forEach((p) => {
            picksMap.set(p.fixture_index, {
              fixture_index: p.fixture_index,
              pick: p.pick,
              gw: p.gw
            });
          });
          
          if (alive) {
            setPicks(picksMap);
            console.log('Loaded', picksMap.size, 'user picks for GW', currentGw);
          }
        }
        
        // Check if user has submitted (confirmed) their predictions
        // All users now read from app_gw_submissions (App tables)
        if (user?.id) {
          const submissionsTable = "app_gw_submissions";
          const { data: submission } = await supabase
            .from(submissionsTable)
            .select("submitted_at")
            .eq("gw", picksGw)
            .eq("user_id", user.id)
            .maybeSingle();
          
          if (alive) {
            setSubmitted(Boolean(submission?.submitted_at));
            console.log('Submission status:', submission?.submitted_at ? 'confirmed' : 'not confirmed');
          }
        }

        // Fetch results for the gameweek being displayed
        // All users now read from app_gw_results (App tables)
        const resultsGw = currentGw;
        const resultsTable = "app_gw_results";
        const { data: rs, error: rsErr } = await supabase
          .from(resultsTable)
          .select("gw,fixture_index,result")
          .eq("gw", resultsGw);

        if (!rsErr && rs) {
          const resultsMap = new Map<number, "H" | "D" | "A">();
          (rs as ResultRow[]).forEach((r) => {
            if (r.result === "H" || r.result === "D" || r.result === "A") {
              resultsMap.set(r.fixture_index, r.result);
            }
          });
          
          if (alive) {
            setResults(resultsMap);
            console.log('Loaded', resultsMap.size, 'results for GW', currentGw);
          }
        }
      } catch (error: any) {
        console.error('Error loading GW data:', error);
        if (alive) {
          setLoading(false);
          // Handle different error types
          let errorMessage = 'Unknown error';
          if (error?.message) {
            errorMessage = error.message;
          } else if (typeof error === 'string') {
            errorMessage = error;
          } else if (error?.toString) {
            errorMessage = error.toString();
          }
          
          // Check if error message contains JSON parsing error
          if (errorMessage.includes('Unexpected token') || errorMessage.includes('is not valid JSON')) {
            errorMessage = 'Server returned invalid response. Please check your connection and try again.';
          }
          
          setError(`Failed to load matches: ${errorMessage}`);
        }
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, [user?.id]);

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="text-red-600 font-semibold text-lg mb-2">Failed to Load Matches</div>
          <div className="text-slate-600 text-sm mb-4">{error}</div>
          <button
            onClick={() => {
              setError("");
              setLoading(true);
              window.location.reload();
            }}
            className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Show loading state
  if (loading || !currentGw || fixtures.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-slate-600">Loading fixtures...</div>
      </div>
    );
  }
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col">
      {/* Main Content - List View for making predictions */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-4">
          {/* Page Header */}
          <div className="mb-6">
            <PageHeader title="Predictions Centre" as="h2" />
            <p className="mt-2 mb-6 text-sm text-slate-600 w-full">
              Call every game, lock in your results, and climb the table.
            </p>
          </div>

          {/* Current Gameweek banner - show different content based on submitted state */}
          {currentGw && (
            <div className="mt-2 mb-3">
              {!submitted ? (
                <div className="rounded-xl border bg-gradient-to-r from-[#1C8376]/10 to-blue-50 border-[#1C8376]/20 px-6 py-4">
                  <div className="text-center">
                    <div className="font-semibold text-[#1C8376] text-lg">Gameweek {currentGw}</div>
                    <div className="text-sm text-slate-600">Make your predictions below</div>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border bg-gradient-to-br from-[#1C8376]/5 to-blue-50/50 shadow-sm px-6 py-5">
                  <div className="text-center">
                    <div className="font-bold text-slate-900 text-xl mb-3">Gameweek {currentGw}</div>
                    {score !== null && (
                      <>
                        <div className="flex items-center justify-center gap-3 mb-3">
                          <div className="text-4xl font-extrabold text-[#1C8376]">{score}/{fixtures.length}</div>
                          {topPercent !== null && (
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-yellow-100 to-orange-100 border border-yellow-300">
                              <span className="text-sm font-bold text-orange-700">Top {topPercent}%</span>
                            </div>
                          )}
                        </div>
                        <div className="mb-3 bg-slate-200 rounded-full h-2 overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-[#1C8376] to-blue-500 transition-all duration-500" 
                            style={{ width: `${(score / fixtures.length) * 100}%` }}
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="space-y-4">
            {fixtures.map((fixture) => {
              const userPick = picks.get(fixture.fixture_index);
              const result = results.get(fixture.fixture_index);
              
              // Get live score for this fixture (real-time updates)
              const apiMatchId = (fixture as any).api_match_id;
              const liveScore = apiMatchId ? liveScoresMap.get(apiMatchId) : null;
              
              // Format kickoff time - using same logic as original Predictions page
              const kickoff = fixture.kickoff_time
                ? (() => {
                    const d = new Date(fixture.kickoff_time);
                    const hh = String(d.getUTCHours()).padStart(2, '0');
                    const mm = String(d.getUTCMinutes()).padStart(2, '0');
                    return `${hh}:${mm}`;
                  })()
                : "—";
              
              // Format live score display
              const showLiveScore = liveScore && (liveScore.status === 'IN_PLAY' || liveScore.status === 'PAUSED' || liveScore.status === 'FINISHED');
              const scoreDisplay = showLiveScore 
                ? `${liveScore.home_score ?? 0}-${liveScore.away_score ?? 0}`
                : kickoff;
              const statusDisplay = liveScore?.status === 'IN_PLAY' 
                ? (liveScore.minute ? `${liveScore.minute}'` : 'LIVE')
                : liveScore?.status === 'PAUSED'
                ? 'HT'
                : liveScore?.status === 'FINISHED'
                ? 'FT'
                : null;
              
              const home = sideName(fixture, "home");
              const away = sideName(fixture, "away");
                      
                      return (
                <div
                  key={fixture.id}
                  className="rounded-2xl border bg-white p-3 shadow-sm"
                >
                  {/* header: Home kickoff Away */}
                  <div className="flex items-center px-2 pt-1 pb-3">
                    <div className="flex items-center gap-1 flex-1 justify-end">
                      <div className="truncate font-medium">{home}</div>
                      <img 
                        src={`/assets/badges/${fixture.home_code?.toUpperCase() || 'UNK'}.png`} 
                        alt={home}
                        className="w-5 h-5"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                              </div>
                    <div className="text-slate-500 text-sm px-4 text-center">
                      {showLiveScore ? (
                        <div className="flex flex-col items-center gap-0.5">
                          <div className="font-bold text-slate-900 text-base">{scoreDisplay}</div>
                          {statusDisplay && (
                            <div className="text-xs text-slate-500">{statusDisplay}</div>
                          )}
                        </div>
                      ) : (
                        kickoff
                      )}
                            </div>
                    <div className="flex items-center gap-1 flex-1 justify-start">
                      <img 
                        src={`/assets/badges/${fixture.away_code?.toUpperCase() || 'UNK'}.png`} 
                        alt={away}
                        className="w-5 h-5"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                      <div className="truncate font-medium">{away}</div>
                            </div>
                          </div>
                          
                  {/* Prediction buttons - show editable or read-only based on submitted state */}
                          <div className="grid grid-cols-3 gap-3">
                            {submitted ? (
                              <>
                                {(() => {
                                  const isCorrect = result && userPick?.pick === result;
                                  const isIncorrect = result && userPick?.pick !== result;
                                  return (
                                    <div className={`h-16 rounded-xl border text-sm font-medium flex items-center justify-center relative overflow-hidden ${
                                      userPick?.pick === "H"
                                        ? isCorrect
                                          ? "bg-gradient-to-br from-yellow-400 via-orange-500 via-pink-500 to-purple-600 text-white border-yellow-300 shadow-xl shadow-gray-400/40 before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/70 before:to-transparent before:animate-[shimmer_1.2s_ease-in-out_infinite] after:absolute after:inset-0 after:bg-gradient-to-r after:from-transparent after:via-yellow-200/50 after:to-transparent after:animate-[shimmer_1.8s_ease-in-out_infinite_0.4s] ring-2 ring-yellow-300/60"
                                          : isIncorrect && result === "H"
                                          ? "bg-red-500 text-white border-red-400"
                                          : "bg-[#1C8376] text-white border-[#1C8376]"
                                        : result === "H"
                                        ? "bg-gray-300 text-slate-700 border-gray-400"
                                        : "bg-slate-50 text-slate-400 border-slate-200"
                                    }`}>
                                      Home Win
                                    </div>
                                  );
                                })()}
                                {(() => {
                                  const isCorrect = result && userPick?.pick === result;
                                  const isIncorrect = result && userPick?.pick !== result;
                                  return (
                                    <div className={`h-16 rounded-xl border text-sm font-medium flex items-center justify-center relative overflow-hidden ${
                                      userPick?.pick === "D"
                                        ? isCorrect
                                          ? "bg-gradient-to-br from-yellow-400 via-orange-500 via-pink-500 to-purple-600 text-white border-yellow-300 shadow-xl shadow-gray-400/40 before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/70 before:to-transparent before:animate-[shimmer_1.2s_ease-in-out_infinite] after:absolute after:inset-0 after:bg-gradient-to-r after:from-transparent after:via-yellow-200/50 after:to-transparent after:animate-[shimmer_1.8s_ease-in-out_infinite_0.4s] ring-2 ring-yellow-300/60"
                                          : isIncorrect && result === "D"
                                          ? "bg-red-500 text-white border-red-400"
                                          : "bg-[#1C8376] text-white border-[#1C8376]"
                                        : result === "D"
                                        ? "bg-gray-300 text-slate-700 border-gray-400"
                                        : "bg-slate-50 text-slate-400 border-slate-200"
                                    }`}>
                                      Draw
                                    </div>
                                  );
                                })()}
                                {(() => {
                                  const isCorrect = result && userPick?.pick === result;
                                  const isIncorrect = result && userPick?.pick !== result;
                                  return (
                                    <div className={`h-16 rounded-xl border text-sm font-medium flex items-center justify-center relative overflow-hidden ${
                                      userPick?.pick === "A"
                                        ? isCorrect
                                          ? "bg-gradient-to-br from-yellow-400 via-orange-500 via-pink-500 to-purple-600 text-white border-yellow-300 shadow-xl shadow-gray-400/40 before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/70 before:to-transparent before:animate-[shimmer_1.2s_ease-in-out_infinite] after:absolute after:inset-0 after:bg-gradient-to-r after:from-transparent after:via-yellow-200/50 after:to-transparent after:animate-[shimmer_1.8s_ease-in-out_infinite_0.4s] ring-2 ring-yellow-300/60"
                                          : isIncorrect && result === "A"
                                          ? "bg-red-500 text-white border-red-400"
                                          : "bg-[#1C8376] text-white border-[#1C8376]"
                                        : result === "A"
                                        ? "bg-gray-300 text-slate-700 border-gray-400"
                                        : "bg-slate-50 text-slate-400 border-slate-200"
                                    }`}>
                                      Away Win
                                    </div>
                                  );
                                })()}
                              </>
                            ) : (
                              <>
                            <button
                              onClick={() => {
                                if (isPastDeadline) return;
                                const newPicks = new Map(picks);
                            newPicks.set(fixture.fixture_index, {
                              fixture_index: fixture.fixture_index,
                              pick: "H",
                              gw: currentGw!
                            });
                                setPicks(newPicks);
                              }}
                              disabled={isPastDeadline}
                              className={`h-16 rounded-xl border text-sm font-medium transition-colors flex items-center justify-center ${
                            userPick?.pick === "H"
                              ? "bg-[#1C8376] text-white border-[#1C8376]"
                                  : isPastDeadline 
                                    ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                              }`}
                            >
                              Home Win
                            </button>
                            
                            <button
                              onClick={() => {
                                if (isPastDeadline) return;
                                const newPicks = new Map(picks);
                            newPicks.set(fixture.fixture_index, {
                              fixture_index: fixture.fixture_index,
                              pick: "D",
                              gw: currentGw!
                            });
                                setPicks(newPicks);
                              }}
                              disabled={isPastDeadline}
                              className={`h-16 rounded-xl border text-sm font-medium transition-colors flex items-center justify-center ${
                            userPick?.pick === "D"
                              ? "bg-[#1C8376] text-white border-[#1C8376]"
                                  : isPastDeadline 
                                    ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                              }`}
                            >
                              Draw
                            </button>
                            
                            <button
                              onClick={() => {
                                if (isPastDeadline) return;
                                const newPicks = new Map(picks);
                            newPicks.set(fixture.fixture_index, {
                              fixture_index: fixture.fixture_index,
                              pick: "A",
                              gw: currentGw!
                            });
                                setPicks(newPicks);
                              }}
                              disabled={isPastDeadline}
                              className={`h-16 rounded-xl border text-sm font-medium transition-colors flex items-center justify-center ${
                            userPick?.pick === "A"
                              ? "bg-[#1C8376] text-white border-[#1C8376]"
                                  : isPastDeadline 
                                    ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                              }`}
                            >
                              Away Win
                            </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
          </div>
        </div>

      {/* Bottom actions - save and confirm predictions */}
        <div className="p-6 bg-white shadow-lg">
          <div className="max-w-2xl mx-auto space-y-3">
            {/* Deadline reminder */}
            {fixtures.length > 0 && (() => {
              const earliestKickoff = fixtures.reduce((earliest, fixture) => {
                if (!fixture.kickoff_time) return earliest;
                const fixtureTime = new Date(fixture.kickoff_time);
                return !earliest || fixtureTime < earliest ? fixtureTime : earliest;
              }, null as Date | null);
              
              return earliestKickoff && (
                <div className="text-center">
                  <div className="text-xs text-slate-500 mb-1">Deadline</div>
                  <div className="text-sm font-bold text-slate-700">
                    {(() => {
                      // TEMPORARY FIX: Treat stored UTC times as local times
                      const deadlineTime = new Date(earliestKickoff.getTime() - (75 * 60 * 1000));
                      const weekday = deadlineTime.toLocaleDateString(undefined, { weekday: 'short' });
                      const month = deadlineTime.toLocaleDateString(undefined, { month: 'short' });
                      const day = deadlineTime.toLocaleDateString(undefined, { day: 'numeric' });
                      const hours = deadlineTime.getUTCHours().toString().padStart(2, '0');
                      const minutes = deadlineTime.getUTCMinutes().toString().padStart(2, '0');
                      return `${weekday}, ${month} ${day}, ${hours}:${minutes}`;
                    })()}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    (75 minutes before first kickoff)
                  </div>
                </div>
              );
            })()}
            
            {/* Show buttons only if not submitted and not past deadline */}
            {!submitted && !isPastDeadline && (
              <>
            {/* Save Predictions Button */}
            <button
                  onClick={() => {
                    if (isPastDeadline) {
                      alert('⚠️ Too late! Predictions are now closed. The deadline was 75 minutes before the first kickoff.');
                      return;
                    }
                    setShowSaveModal(true);
                  }}
              className="w-full py-4 bg-slate-600 text-white rounded-2xl font-bold hover:bg-slate-700 transition-colors"
            >
              Save Predictions
            </button>
            
            {/* Confirm Predictions Button */}
            <button
              onClick={() => {
                if (isPastDeadline) {
                  alert('⚠️ Too late! Predictions are now closed. The deadline was 75 minutes before the first kickoff.');
                  return;
                }
                const allPicksMade = fixtures.every(f => picks.has(f.fixture_index));
                if (allPicksMade) {
                      setShowConfirmModal(true);
                } else {
                  alert("Please make all predictions before confirming");
                }
              }}
                  className="w-full py-4 bg-green-600 text-white rounded-2xl font-bold hover:bg-green-700 transition-colors"
            >
                  Confirm Predictions
            </button>
              </>
            )}
            
            {/* Show deadline passed message */}
            {isPastDeadline && !submitted && (
              <div className="text-center py-6">
                <div className="text-lg font-bold text-red-600 mb-2">⚠️ Deadline Passed</div>
                <div className="text-sm text-slate-600">
                  Predictions are now closed. The deadline was 75 minutes before the first kickoff.
                </div>
              </div>
            )}
            
            {/* Show submitted message if predictions are confirmed */}
            {submitted && (
              <div className="text-center py-6">
                <div className="text-lg font-bold text-green-600 mb-2">✅ Predictions Submitted!</div>
                <div className="text-sm text-slate-600">
                  Your predictions for Gameweek {currentGw} have been confirmed and locked.
                </div>
          </div>
            )}
        </div>
          </div>
          
      {/* Save Predictions Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <div className="text-center">
              <div className="text-2xl font-bold text-slate-900 mb-2">Save Predictions?</div>
              <div className="text-slate-600 mb-6">
                Your predictions will be saved but you can still change them before confirming.
                {fixtures.length > 0 && (() => {
                  const earliestKickoff = fixtures.reduce((earliest, fixture) => {
                    if (!fixture.kickoff_time) return earliest;
                    const fixtureTime = new Date(fixture.kickoff_time);
                    return !earliest || fixtureTime < earliest ? fixtureTime : earliest;
                  }, null as Date | null);
                  
                  return earliestKickoff && (
                    <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                      <div className="text-sm font-medium text-amber-800 mb-1">Deadline Reminder</div>
                      <div className="text-xs text-amber-700">
                        {(() => {
                          // TEMPORARY FIX: Treat stored UTC times as local times
                          const deadlineTime = new Date(earliestKickoff.getTime() - (75 * 60 * 1000));
                          const weekday = deadlineTime.toLocaleDateString(undefined, { weekday: 'short' });
                          const month = deadlineTime.toLocaleDateString(undefined, { month: 'short' });
                          const day = deadlineTime.toLocaleDateString(undefined, { day: 'numeric' });
                          const hours = deadlineTime.getUTCHours().toString().padStart(2, '0');
                          const minutes = deadlineTime.getUTCMinutes().toString().padStart(2, '0');
                          return `${weekday}, ${month} ${day}, ${hours}:${minutes}`;
                        })()}
                      </div>
                      <div className="text-xs text-amber-600 mt-1">
                        (75 minutes before first kickoff)
                      </div>
                    </div>
                  );
                })()}
                </div>
              <div className="flex gap-3">
            <button
                  onClick={() => setShowSaveModal(false)}
                  className="flex-1 py-3 bg-slate-200 text-slate-800 rounded-xl font-bold hover:bg-slate-300 transition-colors"
            >
                  Cancel
            </button>
                <button
                  onClick={async () => {
                    try {
                      // Convert picks map to array for database insertion
                      // App users write directly to app_picks, Web users write to picks (will be mirrored)
                      const picksArray = Array.from(picks.values()).map(pick => ({
                        user_id: user?.id,
                        gw: pick.gw,
                        fixture_index: pick.fixture_index,
                        pick: pick.pick
                      }));

                      // Insert/update picks in database
                      // All users now write to app_picks (App tables)
                      const tableName = 'app_picks';
                      const conflictColumns = 'user_id,gw,fixture_index';
                      
                      const { error } = await supabase
                        .from(tableName)
                        .upsert(picksArray, { 
                          onConflict: conflictColumns,
                          ignoreDuplicates: false 
                        });

                      if (error) {
                        console.error('Error saving picks:', error);
                        alert('Failed to save predictions. Please try again.');
                        return;
                      }

                      console.log('Successfully saved picks:', picksArray);
                      setShowSaveModal(false);
                      setSuccessModalType('saved');
                      setShowSuccessModal(true);
                    } catch (error) {
                      console.error('Error saving picks:', error);
                      alert('Failed to save predictions. Please try again.');
                    }
                  }}
                  className="flex-1 py-3 bg-slate-600 text-white rounded-xl font-bold hover:bg-slate-700 transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
                  </div>
                </div>
              )}
              
      {/* Confirm Predictions Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <div className="text-center">
              <div className="text-2xl font-bold text-slate-900 mb-2">Are You Sure?</div>
              <div className="text-slate-600 mb-6">
                Once confirmed, you cannot change your predictions. Make sure you're happy with all your picks!
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="flex-1 py-3 bg-slate-200 text-slate-800 rounded-xl font-bold hover:bg-slate-300 transition-colors"
                >
                  Go Back
                </button>
                <button
                  onClick={async () => {
                    try {
                      // Convert picks map to array for database insertion
                      // App users write directly to app_picks, Web users write to picks (will be mirrored)
                      const picksArray = Array.from(picks.values()).map(pick => ({
                        user_id: user?.id,
                        gw: pick.gw,
                        fixture_index: pick.fixture_index,
                        pick: pick.pick
                      }));

                      // Insert/update picks in database
                      // All users now write to app_picks (App tables)
                      const tableName = 'app_picks';
                      const conflictColumns = 'user_id,gw,fixture_index';
                      
                      const { error: picksError } = await supabase
                        .from(tableName)
                        .upsert(picksArray, { 
                          onConflict: conflictColumns,
                          ignoreDuplicates: false 
                        });

                      if (picksError) {
                        console.error('Error confirming picks:', picksError);
                        alert('Failed to confirm predictions. Please try again.');
                        return;
                      }

                      // Record submission in appropriate table
                      // All users now write to app_gw_submissions (App tables)
                      const submissionTable = 'app_gw_submissions';
                      const submissionData = {
                        user_id: user?.id,
                        gw: currentGw ?? 1,
                        submitted_at: new Date().toISOString()
                      };
                      const submissionConflict = 'user_id,gw';
                      
                      const { error: submissionError } = await supabase
                        .from(submissionTable)
                        .upsert(submissionData, {
                          onConflict: submissionConflict
                        });

                      if (submissionError) {
                        console.error('Error recording submission:', submissionError);
                        alert('Failed to record submission. Please try again.');
                        return;
                      }

                      // Check if all members have submitted and notify (fire-and-forget)
                      // Get user's leagues
                      const { data: userLeagues } = await supabase
                        .from('league_members')
                        .select('league_id')
                        .eq('user_id', user?.id);

                      if (userLeagues && userLeagues.length > 0) {
                        const gw = currentGw ?? 1;
                        // Call notifyFinalSubmission for each league (fire-and-forget)
                        userLeagues.forEach(({ league_id }) => {
                          fetch('/.netlify/functions/notifyFinalSubmission', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              leagueId: league_id,
                              gw: gw,
                              isAppUser: isInApiTestLeague,
                            }),
                          }).catch(err => {
                            console.error('[NewPredictionsCentre] Failed to check final submission:', err);
                          });
                        });
                      }

                      console.log('Successfully confirmed picks:', picksArray);
                      setSubmitted(true);
                      setShowConfirmModal(false);
                      setSuccessModalType('confirmed');
                      setShowSuccessModal(true);
                      
                      // Trigger banner refresh
                      window.dispatchEvent(new CustomEvent('predictionsSubmitted'));
                      
                      // Navigate to home page after confirmation
                      setTimeout(() => {
                        window.location.href = '/';
                      }, 1500); // Delay to show success message - using window.location for full page reload
                    } catch (error) {
                      console.error('Error confirming picks:', error);
                      alert('Failed to confirm predictions. Please try again.');
                    }
                  }}
                  className="flex-1 py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-colors"
                >
                  Confirm
                </button>
            </div>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <div className="text-center">
              {successModalType === 'saved' ? (
                <>
                  <div className="text-2xl font-bold text-green-600 mb-2">Predictions Saved!</div>
                  <div className="text-slate-600 mb-4">
                    Your predictions have been saved as a draft. You can still edit them until you confirm.
                  </div>
                  <div className="text-sm text-amber-700 bg-amber-50 rounded-lg p-3 mb-6 border border-amber-200">
                    ⚠️ <strong>Important:</strong> Don't forget to come back and publish your predictions before the deadline to make them final!
                  </div>
                </>
              ) : (
                <>
                  <div className="text-2xl font-bold text-green-600 mb-2">Predictions Confirmed!</div>
                  <div className="text-slate-600 mb-6">
                    Your predictions have been published and locked. Good luck!
                  </div>
                </>
              )}
              <button
                onClick={() => setShowSuccessModal(false)}
                className="w-full py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}