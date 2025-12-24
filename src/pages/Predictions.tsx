// src/pages/Predictions.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { getMediumName } from "../lib/teamNames";
import PickButton from "../components/PickButton";
import { invalidateUserCache } from "../lib/cache";
import { PageHeader } from "../components/PageHeader";
import Confetti from "react-confetti";


function sideName(f: any, side: "home" | "away") {
  const nm = f?.[`${side}_name`];
  const team = f?.[`${side}_team`];
  const code = f?.[`${side}_code`];
  const key = code || nm || team || "";
  const resolved = getMediumName(key);
  return resolved || (side === "home" ? "Home" : "Away");
}

/* -----------------------------------------------
   Types
------------------------------------------------ */
type Fixture = {
  gw: number;
  fixture_index: number; // 0..9 within a GW
  home_name?: string | null;
  away_name?: string | null;
  home_team?: string | null;
  away_team?: string | null;
  home_code?: string | null;
  away_code?: string | null;
  kickoff_time?: string | null; // ISO date string
};

type PickRow = {
  user_id: string;
  gw: number;
  fixture_index: number;
  pick: "H" | "D" | "A";
};

type SubmissionRow = { user_id: string; gw: number; submitted_at: string | null };

type ResultRow = {
  gw: number;
  fixture_index: number;
  result?: "H" | "D" | "A" | null;
  home_goals?: number | null;
  away_goals?: number | null;
};

/* -----------------------------------------------
   Helpers
------------------------------------------------ */

function cls(...a: Array<string | false | null | undefined>) {
  return a.filter(Boolean).join(" ");
}

function outcomeOf(r: ResultRow | null | undefined): "H" | "D" | "A" | null {
  if (!r) return null;
  if (r.result === "H" || r.result === "D" || r.result === "A") return r.result;
  if (typeof r.home_goals === "number" && typeof r.away_goals === "number") {
    if (r.home_goals > r.away_goals) return "H";
    if (r.home_goals < r.away_goals) return "A";
    return "D";
  }
  return null;
}

// PickButton is now imported from components

/* -----------------------------------------------
   Read-only result button (same size as PickButton)
   - If it's the correct outcome → green (even if not picked)
   - If it's the user's pick & wrong → soft red
   - Otherwise → neutral
------------------------------------------------ */
function ResultButton({
  label,
  correct, // true = picked & correct, false = picked & wrong, null = not picked
  isCorrectResult,
}: {
  label: string;
  correct: boolean | null;
  isCorrectResult: boolean;
}) {
  const base =
    "h-16 rounded-xl border text-sm font-medium transition-colors flex items-center justify-center select-none";
  
  // Ultra shiny soccer sticker gradient ONLY for correct picks that the user got right
  const correctPickStyle = correct === true
    ? "bg-gradient-to-br from-yellow-400 via-orange-500 via-pink-500 to-purple-600 text-white !border-0 !border-none shadow-2xl shadow-yellow-400/40 transform scale-110 rotate-1 relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/70 before:to-transparent before:animate-[shimmer_1.2s_ease-in-out_infinite] after:absolute after:inset-0 after:bg-gradient-to-r after:from-transparent after:via-yellow-200/50 after:to-transparent after:animate-[shimmer_1.8s_ease-in-out_infinite_0.4s]"
    : isCorrectResult
    ? "bg-emerald-600 text-white border-emerald-600"
    : correct === false
    ? "bg-rose-100 text-rose-700 border-rose-200"
    : "bg-slate-50 text-slate-600 border-slate-200";
  
  return <div className={[base, correctPickStyle].join(" ")}>
    <span className={correct === true ? "font-bold" : ""}>{label}</span>
  </div>;
}

/* -----------------------------------------------
   (Legacy) tiny chip – retained if you ever want it
------------------------------------------------ */

/* -----------------------------------------------
   Page
------------------------------------------------ */
export default function PredictionsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [oldSchoolMode] = useState(() => {
    const saved = localStorage.getItem('oldSchoolMode');
    return saved ? JSON.parse(saved) : false;
  });

  // Save to localStorage when changed
  useEffect(() => {
    localStorage.setItem('oldSchoolMode', JSON.stringify(oldSchoolMode));
  }, [oldSchoolMode]);

  // State
  const [gw, setGw] = useState<number | null>(null);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [choices, setChoices] = useState<Record<number, "H" | "D" | "A" | null>>({});
  const [gwResults, setGwResults] = useState<ResultRow[]>([]);
  const [submitted, setSubmitted] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [justSaved, setJustSaved] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [showSubmitConfirm, setShowSubmitConfirm] = useState<boolean>(false);
  const [isPastDeadline, setIsPastDeadline] = useState<boolean>(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });

  // Track window size for confetti
  useEffect(() => {
    const updateWindowSize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    };
    updateWindowSize();
    window.addEventListener('resize', updateWindowSize);
    return () => window.removeEventListener('resize', updateWindowSize);
  }, []);

  // Auto-scroll to top when submitted
  useEffect(() => {
    if (submitted) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [submitted]);

  // Sync GW with server meta and refresh on focus
  useEffect(() => {
    let alive = true;
    (async () => {
      const cur = await fetchCurrentGw();
      if (alive) setGw(cur);
    })();

    const onFocus = async () => {
      const cur = await fetchCurrentGw();
      setGw(cur);
    };
    window.addEventListener("focus", onFocus);
    return () => {
      alive = false;
      window.removeEventListener("focus", onFocus);
    };
  }, [user?.id]);

  // Load fixtures + my picks + submission when GW or user changes
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError("");

      // If GW has not been resolved yet, wait.
      if (gw == null) {
        setFixtures([]);
        setChoices({});
        setSubmitted(false);
        setLoading(false);
        return;
      }

      // 1) fixtures for GW - read from app_fixtures (where ApiAdmin saves fixtures)
      const { data: fx, error: fxErr } = await supabase
        .from("app_fixtures")
        .select(
          "gw, fixture_index, home_name, away_name, home_team, away_team, home_code, away_code, kickoff_time"
        )
        .eq("gw", gw)
        .order("fixture_index", { ascending: true });

      if (fxErr) {
        if (mounted) {
          setError(fxErr.message);
          setFixtures([]);
          setChoices({});
          setSubmitted(false);
          setLoading(false);
        }
        return;
      }

      const list = (fx as Fixture[]) ?? [];
      if (!mounted) return;
      setFixtures(list);

      // Check deadline - submissions close 75 minutes before first kickoff
      if (list.length > 0 && list[0].kickoff_time) {
        const firstKickoff = new Date(list[0].kickoff_time);
        const deadlineTime = new Date(firstKickoff.getTime() - (75 * 60 * 1000)); // 75 minutes before
        const now = new Date();
        setIsPastDeadline(now > deadlineTime);
      } else {
        setIsPastDeadline(false);
      }

      // 2) my picks for this GW - read from app_picks
      const { data: pk, error: pkErr } = await supabase
        .from("app_picks")
        .select("gw, fixture_index, pick")
        .eq("gw", gw)
        .eq("user_id", user?.id);

      if (pkErr) {
        if (mounted) {
          setError(pkErr.message);
        }
      }

      const next: Record<number, "H" | "D" | "A" | null> = {};
      list.forEach((f) => (next[f.fixture_index] = null));
      (pk as PickRow[] | null)?.forEach((p) => {
        next[p.fixture_index] = p.pick;
      });
      if (!mounted) return;
      setChoices(next);

      // 3) submission state - read from app_gw_submissions
      const { data: sub, error: subErr } = await supabase
        .from("app_gw_submissions")
        .select("gw, submitted_at")
        .eq("gw", gw)
        .eq("user_id", user?.id)
        .maybeSingle();

      if (subErr) {
        if (mounted) setError(subErr.message);
      }
      if (!mounted) return;
      setSubmitted(Boolean((sub as SubmissionRow | null)?.submitted_at));

      // 4) results for this GW - read from app_gw_results
      const { data: rs, error: rsErr } = await supabase
        .from("app_gw_results")
        .select("gw, fixture_index, result")
        .eq("gw", gw);

      if (rsErr) {
        if (mounted) setError(rsErr.message);
      }
      if (mounted) setGwResults((rs as ResultRow[]) ?? []);

      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [gw, user?.id]);

  // Group fixtures by calendar day for section headers
  const grouped = useMemo(() => {
    const byDay = new Map<string, { label: string; items: Fixture[] }>();
    fixtures.forEach((f) => {
      const d = f.kickoff_time ? new Date(f.kickoff_time) : null;
      const key = d ? d.toISOString().slice(0, 10) : "unknown";
      const label = d ? fmtDayHeading(d) : "TBC";
      if (!byDay.has(key)) byDay.set(key, { label, items: [] });
      byDay.get(key)!.items.push(f);
    });
    const entries = [...byDay.entries()].sort((a, b) => {
      const ai = a[1].items[0]?.fixture_index ?? 0;
      const bi = b[1].items[0]?.fixture_index ?? 0;
      return ai - bi;
    });
    return entries.map(([, v]) => v);
  }, [fixtures]);

  // Mutations
  function setPick(idx: number, val: "H" | "D" | "A") {
    if (submitted) return; // locked after submit
    setChoices((prev) => ({ ...prev, [idx]: val }));
  }

  async function saveGW() {
    if (submitted || !user?.id) return;
    setSaving(true);
    setError("");
    try {
      const rows: PickRow[] = Object.entries(choices)
        .filter(([, v]) => v) // non-null
        .map(([fixture_index, pick]) => ({
          user_id: user.id,
          gw: gw!,
          fixture_index: Number(fixture_index),
          pick: pick as "H" | "D" | "A",
        }));

      // Upsert by (user_id, gw, fixture_index) - save to app_picks
      if (rows.length) {
        const { error } = await supabase
          .from("app_picks")
          .upsert(rows, { onConflict: "user_id,gw,fixture_index" });
        if (error) throw error;
      }
      // Show transient saved feedback even if there were no new rows to write
      setJustSaved(true);
      window.setTimeout(() => setJustSaved(false), 2500);
    } catch (e: any) {
      setError(e?.message ?? "Failed to save picks.");
    } finally {
      setSaving(false);
    }
  }

  async function submitGW() {
    if (submitted) return;
    
    // Check deadline - submissions close 75 minutes before first kickoff
    if (fixtures.length > 0 && fixtures[0].kickoff_time) {
      const firstKickoff = new Date(fixtures[0].kickoff_time);
      const deadlineTime = new Date(firstKickoff.getTime() - (75 * 60 * 1000)); // 75 minutes before
      const now = new Date();
      
      if (now > deadlineTime) {
        const weekday = deadlineTime.toLocaleDateString(undefined, { weekday: 'short' });
        const month = deadlineTime.toLocaleDateString(undefined, { month: 'short' });
        const day = deadlineTime.toLocaleDateString(undefined, { day: 'numeric' });
        const hour = String(deadlineTime.getUTCHours()).padStart(2, '0');
        const minute = String(deadlineTime.getUTCMinutes()).padStart(2, '0');
        const deadlineFormatted = `${weekday}, ${month} ${day}, ${hour}:${minute}`;
        setError(`⚠️ Too late! Submissions closed at ${deadlineFormatted}. The deadline was 75 minutes before the first kickoff.`);
        return;
      }
    }
    
    // Show confirmation dialog
    setShowSubmitConfirm(true);
  }

  async function confirmSubmit() {
    if (submitted) return;
    
    // Check deadline - submissions close 75 minutes before first kickoff
    if (fixtures.length > 0 && fixtures[0].kickoff_time) {
      const firstKickoff = new Date(fixtures[0].kickoff_time);
      const deadlineTime = new Date(firstKickoff.getTime() - (75 * 60 * 1000)); // 75 minutes before
      const now = new Date();
      
      if (now > deadlineTime) {
        const weekday = deadlineTime.toLocaleDateString(undefined, { weekday: 'short' });
        const month = deadlineTime.toLocaleDateString(undefined, { month: 'short' });
        const day = deadlineTime.toLocaleDateString(undefined, { day: 'numeric' });
        const hour = String(deadlineTime.getUTCHours()).padStart(2, '0');
        const minute = String(deadlineTime.getUTCMinutes()).padStart(2, '0');
        const deadlineFormatted = `${weekday}, ${month} ${day}, ${hour}:${minute}`;
        setError(`⚠️ Too late! Submissions closed at ${deadlineFormatted}. The deadline was 75 minutes before the first kickoff.`);
        setShowSubmitConfirm(false);
        return;
      }
    }
    
    // ensure picks are saved first
    await saveGW();

    // block if user hasn't made picks for all fixtures
    const totalFixtures = fixtures.length;
    const pickedCount = Object.values(choices).filter(Boolean).length;
    if (pickedCount !== totalFixtures) {
      setError(`Please make predictions for all ${totalFixtures} fixtures before submitting. You have ${pickedCount}/${totalFixtures} completed.`);
      return;
    }

    const { error } = await supabase
      .from("app_gw_submissions")
      .upsert([{ user_id: user?.id, gw, submitted_at: new Date().toISOString() }], {
        onConflict: "user_id,gw",
      });

    if (!error) {
      setSubmitted(true);
      // Invalidate cache so fresh data loads
      if (user?.id) {
        invalidateUserCache(user.id);
      }
      // Dispatch custom event to hide banner immediately
      window.dispatchEvent(new CustomEvent('predictionsSubmitted'));

      // Show confetti
      setShowConfetti(true);

      // Check if all members have submitted in user's leagues and notify (fire-and-forget)
      // Get user's leagues
      const { data: userLeagues } = await supabase
        .from('league_members')
        .select('league_id')
        .eq('user_id', user?.id);

      if (userLeagues && userLeagues.length > 0) {
        // Call notifyFinalSubmission for each league (fire-and-forget)
        userLeagues.forEach(({ league_id }) => {
          fetch('/.netlify/functions/notifyFinalSubmission', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              leagueId: league_id,
              matchday: gw,
              isTestApi: false,
            }),
          }).catch(err => {
            console.error('[Predictions] Failed to check final submission:', err);
          });
        });
      }

      // Navigate to home page after confetti animation
      setTimeout(() => {
        setShowConfetti(false);
        navigate('/');
      }, 3000);
    } else {
      setError(error.message);
    }
    
    setShowSubmitConfirm(false);
  }

  // Build outcome map for current GW
  const outcomeByIdx = new Map<number, "H" | "D" | "A">();
  gwResults.forEach((r: ResultRow) => {
    const out = outcomeOf(r);
    if (out) outcomeByIdx.set(r.fixture_index, out);
  });
  const gwFinished =
    fixtures.length > 0 &&
    outcomeByIdx.size > 0 &&
    outcomeByIdx.size === fixtures.length;

  // My score for this GW (only count decided fixtures)
  const myScore = Object.entries(choices).reduce((acc, [idxStr, pick]) => {
    const idx = Number(idxStr);
    const out = outcomeByIdx.get(idx);
    if (!out || !pick) return acc;
    return acc + (pick === out ? 1 : 0);
  }, 0);

  // UI

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="text-slate-500">Loading…</div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-slate-50 ${oldSchoolMode ? 'oldschool-theme' : ''}`}>
      {showConfetti && windowSize.width > 0 && windowSize.height > 0 && (
        <Confetti
          width={windowSize.width}
          height={windowSize.height}
          recycle={false}
          numberOfPieces={500}
          gravity={0.3}
        />
      )}
      <div className="max-w-6xl mx-auto px-4 py-4">
        <PageHeader title="Predictions Center" as="h2" />
        <p className="mt-2 mb-6 text-sm text-slate-600 w-full">
          Call every game, lock in your results, and climb the table.
        </p>
        <div className="text-slate-600 text-lg font-semibold mt-1">Gameweek {gwOr(gw)}</div>

      {/* status / summary */}
      <div className="mt-3">
        {gwFinished ? (
          <div className="rounded-xl border bg-gradient-to-r from-emerald-50 to-blue-50 border-emerald-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-emerald-900 font-semibold text-lg">GW {gwOr(gw)} Complete</div>
                <div className="text-emerald-900 text-sm font-bold mt-1">Your Score</div>
              </div>
              <div className="text-emerald-900 text-5xl font-extrabold">
                {myScore}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* error banner */}
      {error && (
        <div className="mt-4 rounded border border-rose-200 bg-rose-50 text-rose-700 px-3 py-2 text-sm">
          {error}
        </div>
      )}

      {/* deadline warning banner */}
      {!submitted && fixtures.length > 0 && fixtures[0].kickoff_time && !isPastDeadline && (
        (() => {
          const firstKickoff = new Date(fixtures[0].kickoff_time);
          const deadlineTime = new Date(firstKickoff.getTime() - (75 * 60 * 1000));
          const now = new Date();
          const timeUntilDeadline = deadlineTime.getTime() - now.getTime();
          const hoursUntilDeadline = timeUntilDeadline / (1000 * 60 * 60);
          
          if (hoursUntilDeadline <= 2 && hoursUntilDeadline > 0) {
            const deadlineFormatted = deadlineTime.toLocaleDateString(undefined, { 
              weekday: 'short', 
              month: 'short', 
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            });
            return (
              <div className="mt-4 rounded border border-amber-200 bg-amber-50 text-amber-800 px-3 py-2 text-sm">
                ⏰ <strong>Deadline approaching!</strong> Submissions close at {deadlineFormatted} (75 minutes before first kickoff).
              </div>
            );
          }
          return null;
        })()
      )}

      {/* grouped by day */}
      {grouped.length === 0 ? (
        <div className="mt-6 rounded border bg-white p-4 text-slate-600">
          No fixtures found for GW {gwOr(gw)}. Add fixtures on the Admin page, then come
          back.
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {/* submitted badge (only while results are not in) */}
          {!gwFinished && submitted && (
            <div className="bg-gradient-to-r from-emerald-500 via-green-500 to-emerald-600 rounded-2xl p-6 text-center shadow-2xl shadow-emerald-500/30 transform scale-105 relative overflow-hidden">
              {/* Shimmer effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-[shimmer_2s_ease-in-out_infinite]"></div>
              
              <div className="relative z-10">
                <div className="text-white font-bold text-2xl mb-1">Predictions Submitted!</div>
                <div className="text-emerald-100 text-lg">Your picks are locked in for GW {gw}</div>
                <div className="text-emerald-200 text-sm mt-2">Good luck!</div>
              </div>
            </div>
          )}
          
          {grouped.map((grp, i) => (
            <div key={i}>
              <div className="text-sm font-semibold text-slate-700 mb-3">
                {grp.label}
              </div>
              <div className="space-y-4">
                {grp.items.map((f) => {
                  // robust names + time
                  const home = sideName(f, "home");
                  const away = sideName(f, "away");
                  const kickoff = f.kickoff_time
                    ? fmtKickoffTime(new Date(f.kickoff_time))
                    : "—";
                  const pick = choices[f.fixture_index] ?? null;
                  const decided = outcomeByIdx.get(f.fixture_index) ?? null;

                  return (
                    <div
                      key={f.fixture_index}
                      className="rounded-2xl border bg-white p-3 shadow-sm"
                    >
                      {/* header: Home  kickoff  Away */}
                      <div className="flex items-center px-2 pt-1 pb-3">
                        <div className="flex items-center gap-1 flex-1 justify-end">
                          <div className="truncate font-medium">{home}</div>
                          <img 
                            src={`/assets/badges/${f.home_code?.toUpperCase() || 'UNK'}.png`} 
                            alt={home}
                            className="w-5 h-5"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        </div>
                        <div className="text-slate-500 text-sm px-4">
                          {kickoff}
                        </div>
                        <div className="flex items-center gap-1 flex-1 justify-start">
                          <img 
                            src={`/assets/badges/${f.away_code?.toUpperCase() || 'UNK'}.png`} 
                            alt={away}
                            className="w-5 h-5"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                          <div className="truncate font-medium">{away}</div>
                        </div>
                      </div>

                      {(home === "Home" || away === "Away") && (
                        <div className="px-2 pb-2 text-[11px] text-slate-400">
                          {/* debug: remove later */}
                          {home === "Home" ? `[no home name/code]` : ""}{" "}
                          {away === "Away" ? `[no away name/code]` : ""}
                        </div>
                      )}

                      {/* picks / results */}
                      {gwFinished ? (
                        <div className="grid grid-cols-3 gap-3">
                          {(() => {
                            const picked = choices[f.fixture_index] ?? null;

                            const correctState = (side: "H" | "D" | "A"): boolean | null => {
                              if (picked !== side) return null; // not the user's button
                              if (!decided) return null; // shouldn’t happen if finished
                              return decided === side; // true if correct, false if wrong
                            };

                            return (
                              <>
                                <ResultButton
                                  label="Home Win"
                                  correct={correctState("H")}
                                  isCorrectResult={decided === "H"}
                                />
                                <ResultButton
                                  label="Draw"
                                  correct={correctState("D")}
                                  isCorrectResult={decided === "D"}
                                />
                                <ResultButton
                                  label="Away Win"
                                  correct={correctState("A")}
                                  isCorrectResult={decided === "A"}
                                />
                              </>
                            );
                          })()}
                        </div>
                      ) : (
                        <div className="grid grid-cols-3 gap-3">
                          <PickButton
                            label="Home Win"
                            active={pick === "H"}
                            onClick={() => setPick(f.fixture_index, "H")}
                            disabled={submitted}
                          />
                          <PickButton
                            label="Draw"
                            active={pick === "D"}
                            onClick={() => setPick(f.fixture_index, "D")}
                            disabled={submitted}
                          />
                          <PickButton
                            label="Away Win"
                            active={pick === "A"}
                            onClick={() => setPick(f.fixture_index, "A")}
                            disabled={submitted}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* actions */}
      {!gwFinished && !submitted && fixtures.length > 0 && (
        <div className="mt-6">
          {justSaved && (
            <div className="mb-3 text-center">
              <span
                aria-live="polite"
                className="text-sm rounded border border-emerald-200 bg-emerald-50 text-emerald-900 px-3 py-2 inline-block"
              >
                Saved — don't forget to submit before the deadline.
              </span>
            </div>
          )}
          <div className="flex gap-3">
            <button
              onClick={saveGW}
              disabled={saving}
              className={cls(
                "flex-1 px-4 py-3 rounded-md bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors",
                saving && "opacity-50 cursor-not-allowed"
              )}
            >
              {saving ? "Saving…" : justSaved ? "Saved" : "Save GW"}
            </button>
            <button
              onClick={submitGW}
              disabled={isPastDeadline || Object.values(choices).filter(Boolean).length !== fixtures.length}
              className={cls(
                "flex-1 px-4 py-3 rounded-md text-white font-semibold transition-colors",
                isPastDeadline
                  ? "bg-red-500 cursor-not-allowed"
                  : Object.values(choices).filter(Boolean).length === fixtures.length
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-gray-400 cursor-not-allowed"
              )}
              title={
                isPastDeadline
                  ? "⚠️ Submissions closed - deadline has passed"
                  : Object.values(choices).filter(Boolean).length === fixtures.length
                  ? "Submitting locks your picks for this GW."
                  : `Complete all ${fixtures.length} predictions before submitting`
              }
            >
              {isPastDeadline ? "⚠️ Deadline Passed" : "Submit GW"}
            </button>
          </div>
          <div className="mt-2 text-center">
            <span className="text-xs text-slate-500">
              Submitting locks your picks for this GW.
            </span>
          </div>
        </div>
      )}

      {/* Dummy button for submitted state - triggers confetti and navigates to home */}
      {submitted && fixtures.length > 0 && (
        <div className="mt-6 pb-6">
          <button
            onClick={() => {
              // Set flag for home page to show confetti
              sessionStorage.setItem('showConfettiOnHome', 'true');
              // Navigate and scroll to top immediately
              navigate('/');
              window.scrollTo({ top: 0, behavior: 'instant' });
            }}
            className="w-full py-4 bg-green-600 text-white rounded-2xl font-bold hover:bg-green-700 transition-colors"
          >
            SUBMIT YOUR PREDICTIONS
          </button>
        </div>
      )}

      {/* Submit Confirmation Modal */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4">
            <h3 className="text-lg font-semibold text-slate-900 mb-3">
              Confirm Submission
            </h3>
            <p className="text-slate-600 mb-6">
              Are you sure you want to submit your predictions? Once submitted, they'll be locked for this Gameweek.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowSubmitConfirm(false)}
                className="flex-1 px-4 py-2 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmSubmit}
                className="flex-1 px-4 py-2 rounded-md bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition-colors"
              >
                Submit GW
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

// Fetch the current GW from app_meta (server)
async function fetchCurrentGw(): Promise<number | null> {
  const { data } = await supabase
    .from("app_meta")
    .select("current_gw")
    .eq("id", 1)
    .single();
  return (data as any)?.current_gw ?? null;
}

function gwOr(q: number | null | undefined, fallback: number = 1) {
  return typeof q === "number" && q > 0 ? q : fallback;
}

function fmtDayHeading(d: Date) {
  // e.g. "Sat 19 Oct"
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function fmtKickoffTime(d: Date) {
  // e.g. "13:00" (GMT)
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}