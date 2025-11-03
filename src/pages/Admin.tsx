// src/pages/Admin.tsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { getMediumName } from "../lib/teamNames";
import { useAuth } from "../context/AuthContext";

type Fixture = {
  id: string;
  gw: number;
  fixture_index: number;
  home_team: string | null;
  away_team: string | null;
  home_code: string | null;
  away_code: string | null;
  kickoff_time: string | null;
  kickoff_at?: string | null;
};


type ResultPick = "H" | "D" | "A" | "N" | null;

// Convert team code to initials (e.g., "ARS" -> "ARS", "BHA" -> "BHA")
function getTeamInitials(code: string | null): string {
  if (!code) return "???";
  return code.toUpperCase();
}
function parseKickoffToISO(kickoffText: string): string | null {
  if (!kickoffText) return null;
  
  // Try format with time: "Fri 15:30 Fri 15th Aug"
  let m = kickoffText.match(/^[A-Za-z]{3}\s+(\d{1,2}):(\d{2})\s+[A-Za-z]{3}\s+(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3})/);
  if (m) {
    const [, hh, mm, dayStr, monStr] = m;
    const monthMap: Record<string, string> = {
      Jan: "01", Feb: "02", Mar: "03", Apr: "04",
      May: "05", Jun: "06", Jul: "07", Aug: "08",
      Sep: "09", Oct: "10", Nov: "11", Dec: "12",
    };
    const month = monthMap[monStr];
    if (!month) return null;
    const year = new Date().getFullYear();
    const day = dayStr.padStart(2, "0");
    return `${year}-${month}-${day}T${hh}:${mm}:00`;
  }
  
  // Try format without time: "Fri 15 Aug" - default to 15:00
  m = kickoffText.match(/^[A-Za-z]{3}\s+(\d{1,2})\s+([A-Za-z]{3})/);
  if (m) {
    const [, dayStr, monStr] = m;
    const monthMap: Record<string, string> = {
      Jan: "01", Feb: "02", Mar: "03", Apr: "04",
      May: "05", Jun: "06", Jul: "07", Aug: "08",
      Sep: "09", Oct: "10", Nov: "11", Dec: "12",
    };
    const month = monthMap[monStr];
    if (!month) return null;
    const year = new Date().getFullYear();
    const day = dayStr.padStart(2, "0");
    return `${year}-${month}-${day}T15:00:00`; // Default to 15:00
  }
  
  return null;
}

// Format ISO timestamp to compact human string "Fri 21:00 Fri 15 Aug"
function formatKickoff(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.valueOf())) return "";
  const w = d.toLocaleDateString(undefined, { weekday: "short" });
  // Format time as GMT (no timezone conversion)
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${w} ${hh}:${mm}`;
}

export default function AdminPage() {
  const { user, session } = useAuth();
  const [gw, setGw] = useState(1);
  const [fixtureText, setFixtureText] = useState("");
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [results, setResults] = useState<Record<number, ResultPick>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState(""); // success banner
  const [confirming, setConfirming] = useState(false);
  const [activeGw, setActiveGw] = useState<number | null>(null);
  const [resultsPublished, setResultsPublished] = useState(false);
  const [tab, setTab] = useState<"fixtures" | "results">("fixtures");
  const hasFixtures = fixtures.length > 0;
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [nativePushEnabled, setNativePushEnabled] = useState<boolean | null>(null);
  const [checkingPid, setCheckingPid] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [registerResult, setRegisterResult] = useState<string | null>(null);
  const isAdmin = user?.id === '4542c037-5b38-40d0-b189-847b8f17c222' || user?.id === '36f31625-6d6c-4aa4-815a-1493a812841b';

  // On first load, jump to the most recently published fixtures (current_gw)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("meta")
          .select("current_gw")
          .eq("id", 1)
          .single();
        if (error) return; // silently ignore; fallback to default 1
        const current = (data as any)?.current_gw as number | null;
        if (alive && Number.isFinite(current as number)) {
          setActiveGw(current ?? null);
          if (current) setGw(current);
        }
      } catch (_) {
        /* noop */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  /** Load fixtures + existing results for GW */
  useEffect(() => {
    let alive = true;
    (async () => {
      setError("");
      setOk("");
      const { data: fx, error: fxErr } = await supabase
        .from("fixtures")
        .select("*")
        .eq("gw", gw)
        .order("fixture_index", { ascending: true });

      if (fxErr) {
        if (alive) setError(fxErr.message);
        return;
      }
      if (!alive) return;
      setFixtures((fx as Fixture[]) ?? []);
      setResultsPublished(false);

      const { data: rs, error: rsErr } = await supabase
        .from("gw_results")
        .select("fixture_index, result")
        .eq("gw", gw);

      if (rsErr) console.warn("[Admin] load gw_results error:", rsErr);

      const byIdx: Record<number, ResultPick> = {};
      (rs ?? []).forEach((r: any) => {
        byIdx[Number(r.fixture_index)] = (r.result as ResultPick) ?? null;
      });
      setResultsPublished((rs ?? []).length > 0);
      if (!alive) return;
      setResults(byIdx);
    })();
    return () => {
      alive = false;
    };
  }, [gw]);

  /** Derived: validation */
  const pickedCount = useMemo(
    () => fixtures.reduce((acc, f) => acc + (results[f.fixture_index] ? 1 : 0), 0),
    [fixtures, results]
  );
  const allSelected = fixtures.length > 0 && pickedCount === fixtures.length;
  const remaining = Math.max(0, fixtures.length - pickedCount);

  /** Save fixtures (paste box) */
  async function saveFixtures() {
    setSaving(true);
    setError("");
    setOk("");
    try {
      const lines = fixtureText
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);

      const rows = lines.map((line, idx) => {
        // Format: "BRE v MUN    Sat 12:30 Sat 28th Sep"
        const [teamsPart, ...rest] = line.split(/\s{2,}|\t/);
        const parts = teamsPart.split(/\s+/);
        const home_code = (parts[0] ?? "").toUpperCase();
        const away_code = (parts[2] ?? "").toUpperCase();
        const kickoff_text = rest.join(" ").trim();

        const kickoffISO = parseKickoffToISO(kickoff_text);

        return {
          gw,
          fixture_index: idx,
          home_team: home_code,
          away_team: away_code,
          home_code,
          away_code,
          // Store as ISO into timestamptz column
          kickoff_time: kickoffISO,
        };
      });

      const { error: upErr } = await supabase.from("fixtures").upsert(rows, {
        onConflict: "gw,fixture_index",
      });
      if (upErr) throw upErr;

      setFixtureText("");

      // reload fixtures
      const { data } = await supabase
        .from("fixtures")
        .select("*")
        .eq("gw", gw)
        .order("fixture_index");
      setFixtures((data as Fixture[]) ?? []);
      // Immediately update state so that full team names are shown (use fetched data)
      if (data) {
        setFixtures(data as Fixture[]);
      }
      setOk("Fixtures saved!");
    } catch (e: any) {
      setError(e.message ?? "Failed to save fixtures.");
    } finally {
      setSaving(false);
    }
  }

  async function activateGameweek() {
    if (!confirming) {
      setConfirming(true);
      return;
    }

    setSaving(true);
    setError("");
    setOk("");

    try {
      const { error } = await supabase
        .from("meta")
        .update({ current_gw: gw })
        .eq("id", 1);

      if (error) throw error;

      setOk(`Gameweek ${gw} activated successfully!`);
      setActiveGw(gw);
      
      // Dispatch event to notify PredictionsBanner that fixtures have been published
      window.dispatchEvent(new CustomEvent('fixturesPublished'));

      // Fire-and-forget: broadcast push to all users
      try {
        fetch('/.netlify/functions/sendPushAll', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: `GW${gw} Published`,
            message: `Game Week ${gw} fixtures are live. Make your predictions!`,
            data: { type: 'fixtures_published', gw }
          })
        });
      } catch (_) { /* ignore */ }
    } catch (e: any) {
      setError(e.message ?? "Failed to activate gameweek.");
    } finally {
      setSaving(false);
      setConfirming(false);
    }
  }

  /** Cancel gameweek: delete just-uploaded fixtures for this GW */
  async function cancelGameweek() {
    setSaving(true);
    setError("");
    setOk("");
    try {
      const { error } = await supabase.from("fixtures").delete().eq("gw", gw);
      if (error) throw error;
      setFixtures([]);
      setOk(`Gameweek ${gw} upload cancelled.`);
    } catch (e: any) {
      setError(e.message ?? "Failed to cancel gameweek.");
    } finally {
      setSaving(false);
    }
  }

  /** Save results -> gw_results (UPSERT) */
  async function publishResults() {
    setSaving(true);
    setError("");
    setOk("");
    try {
      // final confirmation
      const okConfirm = window.confirm("⚠️ This will publish and score all results for this Gameweek. Are you sure?");
      if (!okConfirm) {
        setSaving(false);
        return;
      }

      if (!allSelected) {
        throw new Error("Please pick a result (H/D/A/Cancelled) for every fixture before publishing.");
      }

      const rows = fixtures.map((f) => ({
        gw,
        fixture_index: f.fixture_index,
        result: results[f.fixture_index] as "H" | "D" | "A" | "N",
        decided_at: new Date().toISOString(),
      }));

      const { error: upErr } = await supabase
        .from("gw_results")
        .upsert(rows, { onConflict: "gw,fixture_index" });
      if (upErr) throw upErr;

      setOk(`GW ${gw} results published!`);
      
      // Dispatch event to refresh banners across the site
      window.dispatchEvent(new CustomEvent('resultsPublished', { detail: { gw } }));

      // Fire-and-forget: broadcast push to all users
      try {
        fetch('/.netlify/functions/sendPushAll', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: `GW${gw} Results`,
            message: `Results for Game Week ${gw} are published. See how you scored!`,
            data: { type: 'results_published', gw }
          })
        });
      } catch (_) { /* ignore */ }
    } catch (e: any) {
      setError(e.message ?? "Failed to save results.");
    } finally {
      setSaving(false);
    }
  }

  async function recallResults() {
    setSaving(true);
    setError("");
    setOk("");
    try {
      const { error: delErr } = await supabase
        .from("gw_results")
        .delete()
        .eq("gw", gw);
      if (delErr) throw delErr;
      setResults({});
      setOk(`GW ${gw} results recalled (deleted).`);
    } catch (e: any) {
      setError(e.message ?? "Failed to recall results.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-semibold">⚙️ Admin</h1>

      {isAdmin && (
        <div className="mb-6 rounded border bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-semibold">OneSignal Player ID (native)</div>
              <div className="text-sm text-slate-600">Works only inside the Despia native wrapper</div>
              {playerId && (
                <div className="mt-1 text-sm font-mono break-all">{playerId}</div>
              )}
              {nativePushEnabled != null && (
                <div className="mt-1 text-xs text-slate-500">nativePushEnabled: {String(nativePushEnabled)}</div>
              )}
              {registerResult && (
                <div className={`mt-1 text-xs ${registerResult.includes('Success') ? 'text-green-600' : 'text-red-600'}`}>{registerResult}</div>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  setCheckingPid(true);
                  setPlayerId(null);
                  setNativePushEnabled(null);
                  try {
                    const g: any = (globalThis as any);
                    if (g && g.despia) {
                      const d = g.despia;
                      const pid = d?.onesignalplayerid || null;
                      setPlayerId(pid);
                      try {
                        const data = typeof d === 'function' ? d('checkNativePushPermissions://', ['nativePushEnabled']) : null;
                        if (data && typeof data === 'object' && 'nativePushEnabled' in data) {
                          setNativePushEnabled(Boolean((data as any).nativePushEnabled));
                        }
                      } catch {}
                    } else {
                      try {
                        const modName = 'despia-native';
                        // @ts-ignore - vite ignore comment prevents pre-bundling
                        const mod = await import(/* @vite-ignore */ modName);
                        const despia: any = mod?.default;
                        const pid = despia?.onesignalplayerid || null;
                        setPlayerId(pid);
                        try {
                          const data = typeof despia === 'function' ? despia('checkNativePushPermissions://', ['nativePushEnabled']) : null;
                          if (data && typeof data === 'object' && 'nativePushEnabled' in data) {
                            setNativePushEnabled(Boolean((data as any).nativePushEnabled));
                          }
                        } catch {}
                      } catch {
                        setPlayerId(null);
                      }
                    }
                  } finally {
                    setCheckingPid(false);
                  }
                }}
                className="rounded bg-slate-900 px-3 py-2 text-white disabled:opacity-50 text-sm"
                disabled={checkingPid}
              >
                {checkingPid ? 'Checking…' : 'Show Player ID'}
              </button>
              <button
                onClick={async () => {
                  if (!playerId) {
                    setRegisterResult('Please check Player ID first');
                    return;
                  }
                  setRegistering(true);
                  setRegisterResult(null);
                  try {
                    if (!user || !session?.access_token) {
                      setRegisterResult('Error: Not signed in');
                      return;
                    }
                    const res = await fetch('/.netlify/functions/registerPlayer', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${session.access_token}`,
                      },
                      body: JSON.stringify({ playerId, platform: 'ios' }),
                    });
                    const data = await res.json();
                    if (res.ok) {
                      setRegisterResult(`Success! Registered ${playerId.slice(0, 8)}…`);
                    } else {
                      setRegisterResult(`Error: ${data.error || 'Unknown error'}`);
                    }
                  } catch (err: any) {
                    setRegisterResult(`Error: ${err.message || 'Failed to register'}`);
                  } finally {
                    setRegistering(false);
                  }
                }}
                className="rounded bg-emerald-600 px-3 py-2 text-white disabled:opacity-50 text-sm"
                disabled={registering || !playerId}
              >
                {registering ? 'Registering…' : 'Register Device'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GW selector */}
      <div className="mb-6">
        <label className="mr-2">GW</label>
        <select
          value={gw}
          onChange={(e) => setGw(parseInt(e.target.value, 10))}
          className="rounded border px-2 py-1"
        >
          {Array.from({ length: 38 }, (_, i) => i + 1).map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </div>

      {/* Tabs */}
      <div className="mb-4">
        <div className="inline-flex rounded-full bg-slate-100 p-1 text-sm">
          <button
            type="button"
            onClick={() => setTab("fixtures")}
            className={`px-3 py-1 rounded-full transition ${tab === "fixtures" ? "bg-white shadow font-semibold text-slate-900" : "text-slate-600 hover:text-slate-900"}`}
          >
            Fixtures
          </button>
          <button
            type="button"
            onClick={() => setTab("results")}
            className={`ml-1 px-3 py-1 rounded-full transition ${tab === "results" ? "bg-white shadow font-semibold text-slate-900" : "text-slate-600 hover:text-slate-900"}`}
          >
            Results
          </button>
        </div>
      </div>
      
      {/* banners */}
      {error && (
        <div className="mb-4 rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}
      {ok && (
        <div className="mb-4 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {ok}
        </div>
      )}
      
      {/* ----- Tab: Fixtures ----- */}
      {tab === "fixtures" && (
        <div className="mb-8">
          <h2 className="mb-2 text-lg font-semibold">Review Fixtures</h2>
          {fixtures.length === 0 ? (
            <>
              <p className="mb-3 text-slate-500">No fixtures uploaded for GW {gw} yet.</p>
              <h3 className="mb-2 text-base font-semibold">Add Fixtures</h3>
              <textarea
                value={fixtureText}
                onChange={(e) => setFixtureText(e.target.value)}
                rows={8}
                className="w-full rounded border p-2 font-mono text-sm"
                placeholder={`BRE v MUN\tSat 12:30 Sat 28th Sep\nCHE v BHA\tSat 15:00 Sat 28th Sep`}
              />
              <button
                onClick={saveFixtures}
                disabled={saving}
                className="mt-2 rounded bg-slate-900 px-3 py-2 text-white disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save Fixtures"}
              </button>
            </>
          ) : (
            <>
              <ul className="mb-2">
                {fixtures.map((f) => (
                  <li key={f.fixture_index} className="py-1">
                    <span className="font-semibold">
                      {getMediumName(f.home_code || f.home_team || "HOME")}
                    </span>{" "}
                    <span className="text-slate-400">v</span>{" "}
                    <span className="font-semibold">
                      {getMediumName(f.away_code || f.away_team || "AWAY")}
                    </span>
                    <span className="ml-2 text-slate-500">
                      {f.kickoff_time ? formatKickoff(f.kickoff_time) : "TBD"}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-6 flex gap-4">
                <button
                  onClick={activateGameweek}
                  disabled={saving || !hasFixtures || activeGw === gw}
                  className={`rounded px-4 py-3 font-semibold text-white ${saving || !hasFixtures || activeGw === gw ? "bg-emerald-300 cursor-not-allowed" : "bg-emerald-700 hover:bg-emerald-800"}`}
                  title={!hasFixtures ? "Add fixtures first" : activeGw === gw ? "This gameweek is already active" : "Activate this gameweek"}
                >
                  {confirming
                    ? `Are you sure? Click again to confirm.`
                    : `Activate Gameweek ${gw}`}
                </button>
                <button
                  onClick={cancelGameweek}
                  disabled={saving}
                  className="rounded bg-rose-600 px-4 py-3 text-white font-semibold hover:bg-rose-700"
                >
                  Cancel Upload
                </button>
              </div>
            </>
          )}
        </div>
      )}
      
      {/* ----- Tab: Results ----- */}
      {tab === "results" && (
        <div>
          <h2 className="mb-2 text-lg font-semibold">Enter Results</h2>
          {fixtures.length === 0 ? (
            <p className="text-slate-500">No fixtures yet for GW {gw}.</p>
          ) : (
            <>
              <div className="mb-2 text-xs text-slate-500">
                {allSelected ? "All fixtures selected (H/D/A/Cancelled)." : `Pick results for ${remaining} more fixture${remaining === 1 ? "" : "s"} (H/D/A/Cancelled).`}
              </div>
              <table className="w-full border text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-2 py-1 text-left">Fixture</th>
                    <th className="px-2 py-1">Home Win</th>
                    <th className="px-2 py-1">Draw</th>
                    <th className="px-2 py-1">Away Win</th>
                    <th className="px-2 py-1">Cancelled</th>
                  </tr>
                </thead>
                <tbody>
                  {fixtures.map((f) => {
                    const labelLeft = getTeamInitials(f.home_code || f.home_team);
                    const labelRight = getTeamInitials(f.away_code || f.away_team);
                    return (
                      <tr key={f.fixture_index} className="border-t">
                        <td className="px-2 py-1">
                          {labelLeft} <span className="text-slate-400">v</span> {labelRight}
                        </td>
                        <td className="px-2 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => setResults((prev) => ({ ...prev, [f.fixture_index]: "H" }))}
                            className={`w-12 h-8 rounded-md font-semibold text-sm transition-colors ${
                              (results[f.fixture_index] ?? null) === "H"
                                ? "bg-emerald-600 text-white"
                                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                            }`}
                          >
                            H
                          </button>
                        </td>
                        <td className="px-2 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => setResults((prev) => ({ ...prev, [f.fixture_index]: "D" }))}
                            className={`w-12 h-8 rounded-md font-semibold text-sm transition-colors ${
                              (results[f.fixture_index] ?? null) === "D"
                                ? "bg-emerald-600 text-white"
                                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                            }`}
                          >
                            D
                          </button>
                        </td>
                        <td className="px-2 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => setResults((prev) => ({ ...prev, [f.fixture_index]: "A" }))}
                            className={`w-12 h-8 rounded-md font-semibold text-sm transition-colors ${
                              (results[f.fixture_index] ?? null) === "A"
                                ? "bg-emerald-600 text-white"
                                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                            }`}
                          >
                            A
                          </button>
                        </td>
                        <td className="px-2 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => setResults((prev) => ({ ...prev, [f.fixture_index]: "N" }))}
                            className={`w-8 h-6 rounded text-xs transition-colors ${
                              (results[f.fixture_index] ?? null) === "N"
                                ? "bg-red-500 text-white"
                                : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                            }`}
                          >
                            N
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="mt-3 flex gap-3">
                <button
                  onClick={publishResults}
                  disabled={saving || !allSelected || resultsPublished}
                  className={`rounded px-3 py-2 text-white ${resultsPublished ? "bg-gray-300 cursor-not-allowed text-gray-700" : "bg-red-600"} disabled:opacity-50`}
                  title={
                    resultsPublished
                      ? "Results already published for this GW"
                      : !allSelected
                      ? "Pick a result for every fixture"
                      : "Publish gameweek results"
                  }
                >
                  {saving ? "Publishing…" : "Publish GW"}
                </button>
                <button
                  onClick={recallResults}
                  disabled={saving || !resultsPublished}
                  className={`rounded px-3 py-2 ${resultsPublished ? "bg-gray-300 text-gray-900 hover:bg-gray-400" : "bg-gray-200 text-gray-500 cursor-not-allowed"}`}
                  title={resultsPublished ? "Delete published results for this GW" : "No published results to recall"}
                >
                  Recall GW
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}